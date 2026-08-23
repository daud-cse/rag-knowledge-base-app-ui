import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { SsoService } from './sso.service';
import { AuthProviders, LoginResponse, Me, Role, ROLE_RANK } from './models';

const TOKEN_KEY = 'uttor.token';
const USER_KEY = 'uttor.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly sso = inject(SsoService);

  readonly user = signal<Me | null>(this.restoreUser());
  readonly isAuthenticated = computed(() => this.user() !== null);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', { email, password }).pipe(
      tap(response => {
        localStorage.setItem(TOKEN_KEY, response.accessToken);
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
        this.user.set(response.user);
      })
    );
  }

  providers(): Observable<AuthProviders> {
    return this.http.get<AuthProviders>('/api/auth/providers');
  }

  logout(): void {
    // Fire and forget: the audit entry is useful but must not block leaving the app.
    this.http.post('/api/auth/logout', {}).subscribe({ error: () => undefined });
    this.sso.forgetGoogleSession();
    this.clear();
    this.router.navigate(['/login']);
  }

  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
  }

  /** Roles are a ladder, so a check is always "at least this role". */
  hasRole(minimum: Role): boolean {
    const current = this.user()?.role;
    return !!current && ROLE_RANK[current] >= ROLE_RANK[minimum];
  }

  private restoreUser(): Me | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw || !localStorage.getItem(TOKEN_KEY)) return null;
    try {
      return JSON.parse(raw) as Me;
    } catch {
      return null;
    }
  }
}
