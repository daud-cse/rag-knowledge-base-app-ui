import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, catchError, finalize, retry, tap, throwError, timer } from 'rxjs';
import { ApiHealthService, isColdStartError } from './api-health.service';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { environment } from '../../environments/environment';

/** How long a request may run before it is worth telling the person the server is waking up. */
const SLOW_AFTER_MS = 4000;

/** ~60s of patience, which covers a cold container plus an Azure SQL resume. */
const COLD_START_RETRIES = 20;
const RETRY_DELAY_MS = 3000;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const health = inject(ApiHealthService);

  const token = auth.token;
  // In dev apiBase is empty and the dev-server proxy handles /api. In production the UI is served
  // from Static Web Apps and the API lives on its own Container Apps origin, so /api is rewritten
  // to an absolute URL. The startsWith('/api') test still gates the token, so it never leaves our API.
  const isApi = req.url.startsWith('/api');
  const url = isApi ? environment.apiBase + req.url : req.url;
  const request = token && isApi
    ? req.clone({ url, setHeaders: { Authorization: `Bearer ${token}` } })
    : req.clone({ url });

  // A request that is merely slow is the normal shape of a cold start: Container Apps queues the
  // call and boots a replica rather than refusing it. So the banner is driven by elapsed time, not
  // only by errors.
  let slow = false;
  let slowTimer: Subscription | undefined;
  const markSlow = () => {
    if (slow) return;
    slow = true;
    health.beginSlow();
  };
  if (isApi) slowTimer = timer(SLOW_AFTER_MS).subscribe(markSlow);

  return next(request).pipe(
    retry({
      count: COLD_START_RETRIES,
      delay: (error: unknown) => {
        const status = error instanceof HttpErrorResponse ? error.status : -1;

        // Only reads are replayed. A POST that failed at the gateway may still have been applied,
        // and silently sending a chat message or an upload twice is worse than one clear error.
        if (!isApi || request.method !== 'GET' || !isColdStartError(status))
          return throwError(() => error);

        markSlow();
        return timer(RETRY_DELAY_MS);
      }
    }),
    tap(event => {
      // Only a real response counts. The stream also emits a Sent event the instant the request
      // leaves, and clearing on that would let a request starting now hide a banner that another,
      // genuinely stuck request had put up.
      if (isApi && event instanceof HttpResponse) health.clear();
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/login')) {
        auth.clear();
        router.navigate(['/login']);
        toast.error('Your session expired. Please sign in again.');
      } else if (error.status === 403) {
        toast.error('Your role does not allow that action.');
      } else if (error.status === 429) {
        // The daily token allowance. The API sends a message explaining how much is left and
        // when it resets, so show that rather than a generic "too many requests".
        toast.error(apiMessage(error, 'Your token limit is exceeded for today.'));
      } else if (isColdStartError(error.status)) {
        // Reads have already been retried to exhaustion by this point, so this is either a write
        // or a genuinely unreachable API. Say which, rather than "cannot reach the API".
        toast.error(request.method === 'GET'
          ? 'The server is still waking up. Please try again in a moment.'
          : 'The server was asleep and did not receive that. Please try again.');
      }
      return throwError(() => error);
    }),
    finalize(() => {
      slowTimer?.unsubscribe();
      if (slow) health.endSlow();
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
