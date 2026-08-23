import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { SsoService } from '../../core/sso.service';
import { apiMessage } from '../../core/http';
import { AuthProviders, LoginResponse } from '../../core/models';

type AccountType = 'Personal' | 'Company';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './login.component.scss'
})
export class SignupComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly sso = inject(SsoService);
  private readonly router = inject(Router);

  readonly accountType = signal<AccountType>('Personal');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly providers = signal<AuthProviders | null>(null);

  email = '';
  password = '';
  displayName = '';
  companyName = '';
  allowedEmailDomains = '';

  constructor() {
    this.sso.providers().subscribe({ next: p => this.providers.set(p), error: () => undefined });
    if (this.auth.isAuthenticated()) this.router.navigate(['/chat']);
  }

  choose(type: AccountType): void {
    this.accountType.set(type);
    this.error.set(null);
  }

  submit(): void {
    if (this.busy()) return;
    const isCompany = this.accountType() === 'Company';

    if (!this.email.trim() || !this.password) {
      this.error.set('Email and password are required.');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('Password must be at least 8 characters.');
      return;
    }
    if (isCompany && !this.companyName.trim()) {
      this.error.set('Company name is required.');
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    this.api.registerWorkspace({
      accountType: this.accountType(),
      email: this.email.trim(),
      password: this.password,
      displayName: this.displayName.trim() || undefined,
      companyName: isCompany ? this.companyName.trim() : null,
      allowedEmailDomains: isCompany ? (this.allowedEmailDomains.trim() || null) : null
    }).subscribe({
      next: (response: LoginResponse) => {
        // The API returns a session with the account, so there is no second sign-in step.
        localStorage.setItem('uttor.token', response.accessToken);
        localStorage.setItem('uttor.user', JSON.stringify(response.user));
        this.auth.user.set(response.user);
        this.router.navigate(['/chat']);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiMessage(err, 'Could not create the account.'));
      }
    });
  }
}
