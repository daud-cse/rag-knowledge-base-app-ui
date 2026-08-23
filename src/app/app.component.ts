import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
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
}
