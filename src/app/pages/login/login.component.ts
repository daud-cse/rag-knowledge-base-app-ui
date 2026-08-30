import { AfterViewInit, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { SsoService } from '../../core/sso.service';
import { apiMessage } from '../../core/http';
import { AuthProviders, LoginResponse, ProviderStatus } from '../../core/models';

interface DemoAccount {
  email: string;
  role: string;
  blurb: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly sso = inject(SsoService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('googleHost') googleHost?: ElementRef<HTMLDivElement>;

  email = 'admin@contoso.com';
  password = 'Passw0rd!';

  readonly busy = signal(false);
  readonly ssoBusy = signal(false);
  readonly error = signal<string | null>(null);
  readonly providers = signal<AuthProviders | null>(null);
  readonly status = signal<ProviderStatus | null>(null);

  readonly demoAccounts: DemoAccount[] = [
    { email: 'super@ragkb.app', role: 'Super Admin', blurb: 'Manages companies across the platform.' },
    { email: 'admin@contoso.com', role: 'Company Admin', blurb: 'Full access inside Contoso Health.' },
    { email: 'knowledge@contoso.com', role: 'Knowledge Admin', blurb: 'Owns knowledge bases and documents.' },
    { email: 'user@contoso.com', role: 'User', blurb: 'Chat only, Internal clearance.' }
  ];

  constructor() {
    this.api.status().subscribe({ next: s => this.status.set(s), error: () => undefined });
    if (this.auth.isAuthenticated()) this.router.navigate(['/chat']);
  }

  ngAfterViewInit(): void {
    this.sso.providers().subscribe({
      next: p => {
        this.providers.set(p);
        if (p.google && p.googleClientId) this.mountGoogleButton(p.googleClientId);
      },
      error: () => undefined
    });
  }

  /// The host element lives inside an `@if` that only renders once the providers response arrives,
  /// and Google will not draw into an element that is not laid out yet. Both can lag this call by a
  /// frame or two — and they reliably do on a client-side navigation back to /login, where the
  /// library is already cached and so resolves immediately instead of after a network fetch.
  /// Waiting for the element, rather than giving up on the first miss, is what makes the button
  /// appear on a second visit as well as the first.
  private mountGoogleButton(clientId: string, attempt = 0): void {
    const host = this.googleHost?.nativeElement;

    if (!host || host.offsetParent === null) {
      if (attempt < 30) {
        requestAnimationFrame(() => this.mountGoogleButton(clientId, attempt + 1));
      } else {
        this.error.set('Google sign-in could not be displayed. Reload the page to try again.');
      }
      return;
    }

    // Re-entering the page must not stack a second button or keep a dead one from the last visit.
    host.replaceChildren();

    this.sso.renderGoogleButton(host, clientId,
      idToken => this.completeSso('google', idToken),
      message => this.error.set(message));
  }

  async signInWithMicrosoft(): Promise<void> {
    const p = this.providers();
    if (!p?.entraClientId || !p.entraAuthority || this.ssoBusy()) return;

    this.ssoBusy.set(true);
    this.error.set(null);
    try {
      const idToken = await this.sso.signInWithMicrosoft(p.entraClientId, p.entraAuthority);
      this.completeSso('microsoft', idToken);
    } catch (error) {
      this.ssoBusy.set(false);
      const message = (error as Error)?.message ?? 'Microsoft sign-in failed.';
      // Closing the popup is a cancellation, not an error worth shouting about.
      if (!/user_cancelled|popup_window_error|user_canceled/i.test(message)) this.error.set(message);
    }
  }

  private completeSso(provider: 'google' | 'microsoft', idToken: string): void {
    this.ssoBusy.set(true);
    this.error.set(null);
    this.sso.exchange(provider, idToken).subscribe({
      next: response => this.finish(response),
      error: err => {
        this.ssoBusy.set(false);
        this.error.set(apiMessage(err, 'Single sign-on failed.'));
      }
    });
  }

  private finish(response: LoginResponse): void {
    this.auth.user.set(response.user);
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/chat';
    this.router.navigateByUrl(returnUrl);
  }

  use(account: DemoAccount): void {
    this.email = account.email;
    this.password = 'Passw0rd!';
  }

  submit(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    this.auth.login(this.email.trim(), this.password).subscribe({
      next: response => this.finish(response),
      error: err => {
        this.error.set(apiMessage(err, 'Sign-in failed.'));
        this.busy.set(false);
      }
    });
  }
}
