import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ApiHealthService } from './core/api-health.service';
import { AuthService } from './core/auth.service';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <!--
      The API sleeps when idle, so a signed-in person who steps away comes back to requests that
      take most of a minute. Only shown once signed in: the login page runs its own readiness wait
      and would otherwise say the same thing twice.
    -->
    @if (health.waking() && auth.isAuthenticated()) {
      <div class="wake-bar" role="status" aria-live="polite">
        <span class="spinner"></span>
        <span>
          <strong>Server waking up</strong>
          Pages may look empty until this finishes — nothing has been lost. It can take up to a
          minute, then your data appears on its own.
        </span>
        @if (health.seconds() > 4) { <span class="wake-secs">{{ health.seconds() }}s</span> }
      </div>
    }

    <router-outlet />

    <div class="toast-host">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class.success]="toast.kind === 'success'" [class.error]="toast.kind === 'error'">
          <span style="flex:1">{{ toast.text }}</span>
          <button type="button" (click)="toasts.dismiss(toast.id)" aria-label="Dismiss">&times;</button>
        </div>
      }
    </div>
  `
})
export class AppComponent {
  readonly toasts = inject(ToastService);
  readonly health = inject(ApiHealthService);
  readonly auth = inject(AuthService);
}
