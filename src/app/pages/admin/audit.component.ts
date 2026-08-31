import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { apiMessage } from '../../core/http';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { AuditEntry } from '../../core/models';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Audit log</h1>
          <p class="subtitle">
            Every sign-in, question asked, document touched and administrative change.
            {{ total() }} entries
            @if (isSuperAdmin()) { <strong>across all companies</strong> } @else { in this company }.
          </p>
        </div>
        <div class="row">
          <button class="btn" type="button" (click)="filter('auth.')" title="Sign-ins only">
            Sign-ins
          </button>
          <input type="search" placeholder="Filter by action, e.g. chat.message"
                 [ngModel]="action()" (ngModelChange)="filter($event)" name="action" style="width:230px" />
          <input type="search" placeholder="Filter by user email"
                 [ngModel]="email()" (ngModelChange)="filterEmail($event)" name="email" style="width:200px" />
          <button class="btn" type="button" (click)="load()">↻ Refresh</button>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>When</th>
                @if (isSuperAdmin()) { <th>Company</th> }
                <th>User</th><th>Action</th><th>Entity</th><th>Details</th><th>IP</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of entries(); track entry.id) {
                <tr>
                  <td class="small mono">{{ entry.timestamp | date: 'MMM d, HH:mm:ss' }}</td>
                  @if (isSuperAdmin()) {
                    <td class="small">{{ entry.tenantName || '—' }}</td>
                  }
                  <td class="small">{{ entry.userEmail || 'system' }}</td>
                  <td>
                    <span class="badge"
                          [class.brand]="entry.action.startsWith('auth.')"
                          [class.danger]="entry.action === 'auth.login.failed'">{{ entry.action }}</span>
                  </td>
                  <td class="small">
                    {{ entry.entityType || '—' }}
                    @if (entry.entityId) { <div class="muted mono" style="font-size:10.5px">{{ entry.entityId }}</div> }
                  </td>
                  <td class="details">{{ entry.details || '—' }}</td>
                  <td class="small mono">{{ entry.ipAddress || '—' }}</td>
                </tr>
              } @empty {
                <tr><td [attr.colspan]="isSuperAdmin() ? 7 : 6"><div class="empty">
                  <span class="icon">🗂️</span>No audit entries match this filter.
                </div></td></tr>
              }
            </tbody>
          </table>
        </div>

        <div class="card-head" style="border-top:1px solid var(--border);border-bottom:none">
          <span class="muted small">
            Page {{ page() }} of {{ pageCount() }} · {{ total() }} entries
          </span>
          <span class="row">
            <button class="btn sm" type="button" [disabled]="page() <= 1" (click)="go(page() - 1)">← Previous</button>
            <button class="btn sm" type="button" [disabled]="page() >= pageCount()" (click)="go(page() + 1)">Next →</button>
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .details {
      font-family: var(--mono);
      font-size: 11px;
      color: var(--text-muted);
      max-width: 460px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `]
})
export class AuditComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly entries = signal<AuditEntry[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly action = signal('');
  readonly email = signal('');
  readonly isSuperAdmin = computed(() => this.auth.user()?.role === 'SuperAdmin');
  private readonly pageSize = 50;

  constructor() {
    this.load();
  }

  pageCount(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  load(): void {
    this.api.audit(this.page(), this.pageSize, this.action() || undefined,
                   this.email() || undefined).subscribe({
      next: result => {
        this.entries.set(result.items);
        this.total.set(result.total);
      },
      error: err => this.toast.error(apiMessage(err, 'Could not load the audit log.'))
    });
  }

  filter(value: string): void {
    this.action.set(value);
    this.page.set(1);
    this.load();
  }

  filterEmail(value: string): void {
    this.email.set(value);
    this.page.set(1);
    this.load();
  }

  go(page: number): void {
    this.page.set(page);
    this.load();
  }
}
