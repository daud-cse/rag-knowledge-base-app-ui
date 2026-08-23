import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthProviders, LoginResponse } from './models';

declare const google: any;

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const TOKEN_KEY = 'uttor.token';
const USER_KEY = 'uttor.user';

/**
 * Both providers use the same shape: the browser obtains an ID token from the identity provider,
 * the API verifies its signature and issues an application session. The API never trusts the
 * email the browser claims — only what the provider signed.
 */
@Injectable({ providedIn: 'root' })
export class SsoService {
  private readonly http = inject(HttpClient);
  private gsiLoaded?: Promise<void>;
  private msal?: any;

  /** Loads the Google Identity Services script once, on demand. */
  private loadGoogle(): Promise<void> {
    if (this.gsiLoaded) return this.gsiLoaded;

    this.gsiLoaded = new Promise<void>((resolve, reject) => {
      if (typeof google !== 'undefined' && google?.accounts?.id) return resolve();
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load Google sign-in.'));
      document.head.appendChild(script);
    });
    return this.gsiLoaded;
  }

  /**
   * Renders Google's own button into the given element. Google requires its rendered button (or
   * One Tap) rather than an arbitrary click handler, so the caller supplies a host element.
   */
  async renderGoogleButton(host: HTMLElement, clientId: string,
    onToken: (idToken: string) => void, onError: (message: string) => void): Promise<void> {
    try {
      await this.loadGoogle();
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential?: string }) => {
          if (response?.credential) onToken(response.credential);
          else onError('Google did not return an identity token.');
        },
        auto_select: false,
        cancel_on_tap_outside: true
      });
      google.accounts.id.renderButton(host, {
        theme: 'outline',
        size: 'large',
        width: host.clientWidth || 340,
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left'
      });

      // renderButton fails silently if the element is not in a state it likes, which otherwise
      // shows up as an empty gap where the button should be.
      requestAnimationFrame(() => {
        if (host.childElementCount === 0) {
          onError('Google sign-in did not load. Reload the page, or use your email below.');
        }
      });
    } catch (error) {
      onError((error as Error).message);
    }
  }

  /// Clears Google's remembered account so signing out does not immediately sign the same person
  /// back in on the next visit to the login page.
  forgetGoogleSession(): void {
    try {
      if (typeof google !== 'undefined' && google?.accounts?.id) {
        google.accounts.id.disableAutoSelect();
      }
    } catch {
      // Nothing to clear.
    }
  }

  /** Opens the Microsoft sign-in popup and returns the ID token it issues. */
  async signInWithMicrosoft(clientId: string, authority: string): Promise<string> {
    const { PublicClientApplication } = await import('@azure/msal-browser');

    if (!this.msal) {
      this.msal = new PublicClientApplication({
        auth: { clientId, authority, redirectUri: window.location.origin },
        cache: { cacheLocation: 'sessionStorage' }
      });
      await this.msal.initialize();
    }

    const result = await this.msal.loginPopup({ scopes: ['openid', 'profile', 'email'] });
    if (!result?.idToken) throw new Error('Microsoft did not return an identity token.');
    return result.idToken;
  }

  /** Trades a provider ID token for an application session. */
  exchange(provider: 'google' | 'microsoft', idToken: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/external', { provider, idToken }).pipe(
      tap(response => {
        localStorage.setItem(TOKEN_KEY, response.accessToken);
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      })
    );
  }

  providers(): Observable<AuthProviders> {
    return this.http.get<AuthProviders>('/api/auth/providers');
  }
}
