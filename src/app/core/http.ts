import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const token = auth.token;
  // In dev apiBase is empty and the dev-server proxy handles /api. In production the UI is served
  // from Static Web Apps and the API lives on its own Container Apps origin, so /api is rewritten
  // to an absolute URL. The startsWith('/api') test still gates the token, so it never leaves our API.
  const isApi = req.url.startsWith('/api');
  const url = isApi ? environment.apiBase + req.url : req.url;
  const request = token && isApi
    ? req.clone({ url, setHeaders: { Authorization: `Bearer ${token}` } })
    : req.clone({ url });

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/login')) {
        auth.clear();
        router.navigate(['/login']);
        toast.error('Your session expired. Please sign in again.');
      } else if (error.status === 403) {
        toast.error('Your role does not allow that action.');
      } else if (error.status === 0) {
        toast.error('Cannot reach the API. Is it running?');
      }
      return throwError(() => error);
    })
  );
};

/** Pulls the API's `{ message }` body out of an error, with sensible fallbacks. */
export function apiMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error;
    if (typeof body === 'string' && body.trim()) return body;
    if (body && typeof body === 'object' && 'message' in body) return String((body as any).message);
    if (error.status === 0) return 'Cannot reach the API.';
    return `${error.status} ${error.statusText}`;
  }
  return fallback;
}
