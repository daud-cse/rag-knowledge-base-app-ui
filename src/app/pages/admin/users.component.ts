import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { apiMessage } from '../../core/http';
import { ToastService } from '../../core/toast.service';
import { AppUser, CLASSIFICATIONS, Role } from '../../core/models';

const ROLES: { value: Role; label: string; blurb: string }[] = [
  { value: 'User', label: 'User', blurb: 'Chat, personal knowledge base, own conversations.' },
  { value: 'ChatbotAdmin', label: 'Chatbot Admin', blurb: 'Everything a user can do, plus create and configure chatbots and see analytics.' },
  { value: 'KnowledgeAdmin', label: 'Knowledge Admin', blurb: 'Also manages company knowledge bases and documents.' },
  { value: 'CompanyAdmin', label: 'Company Admin', blurb: 'Also manages users, roles and the audit log.' },
  { value: 'SuperAdmin', label: 'Super Admin', blurb: 'Also manages companies across the platform.' }
];

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Users &amp; roles</h1>
          <p class="subtitle">
            Accounts inside {{ auth.user()?.tenantName }}. Roles are a ladder — each one includes
            everything below it — and clearance decides which classified documents a user can retrieve.
          </p>
        </div>
        <button class="btn primary" type="button" (click)="startCreate()">＋ Add user</button>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-body tight">
          <div class="ladder">
            @for (role of roles; track role.value) {
              <div class="rung">
                <strong>{{ role.label }}</strong>
                <span>{{ role.blurb }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>User</th><th>Role</th><th>Clearance</th><th>Department</th>
                <th>Status</th><th>Last sign-in</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (user of users(); track user.id) {
                <tr>
                  <td>
                    <strong>{{ user.displayName }}</strong>
                    <div class="muted small mono">{{ user.email }}</div>
                  </td>
                  <td><span class="badge brand">{{ user.role }}</span></td>
                  <td><span class="badge">{{ user.maxClassification }}</span></td>
                  <td class="small">{{ user.department || '—' }}</td>
                  <td>
                    <span class="badge" [class.good]="user.isActive" [class.warn]="!user.isActive">
                      {{ user.isActive ? 'Active' : 'Disabled' }}
                    </span>
                  </td>
                  <td class="small">
                    {{ user.lastLoginAt ? (user.lastLoginAt | date: 'MMM d, HH:mm') : 'Never' }}
                  </td>
                  <td class="actions">
                    <button class="btn ghost sm" type="button" (click)="startEdit(user)">Edit</button>
                    @if (user.id !== auth.user()?.id) {
                      <button class="btn ghost sm" type="button" (click)="remove(user)">Delete</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7"><div class="empty">No users yet.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    @if (editing(); as user) {
      <div class="modal-backdrop" (click)="editing.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <header>
            <h2>{{ user.id ? 'Edit ' + user.displayName : 'Add user' }}</h2>
            <button class="btn ghost sm" type="button" (click)="editing.set(null)">✕</button>
          </header>

          <div class="body">
            <div class="grid cols-2">
              <label class="field">
                <span class="label">Display name</span>
                <input type="text" [(ngModel)]="form.displayName" name="displayName" />
              </label>
              <label class="field">
                <span class="label">Email</span>
                <input type="email" [(ngModel)]="form.email" name="email" [disabled]="!!user.id" />
              </label>
            </div>

            <div class="grid cols-2">
              <label class="field">
                <span class="label">Role</span>
                <select [(ngModel)]="form.role" name="role">
                  @for (role of assignableRoles(); track role.value) {
                    <option [value]="role.value">{{ role.label }}</option>
                  }
                </select>
                <span class="hint">You cannot grant a role above your own.</span>
              </label>
              <label class="field">
                <span class="label">Document clearance</span>
                <select [(ngModel)]="form.maxClassification" name="maxClassification">
                  @for (level of levels; track level) { <option [value]="level">{{ level }}</option> }
                </select>
                <span class="hint">Retrieval hides anything classified above this level.</span>
              </label>
            </div>

            <div class="grid cols-2">
              <label class="field">
                <span class="label">Department</span>
                <input type="text" [(ngModel)]="form.department" name="department" />
              </label>
              <label class="field">
                <span class="label">{{ user.id ? 'New password (optional)' : 'Password' }}</span>
                <input type="password" [(ngModel)]="form.password" name="password"
                       autocomplete="new-password" />
              </label>
            </div>

            @if (user.id) {
              <label class="check">
                <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />
                <span class="check-text">
                  <strong>Active</strong><span>Disabled accounts cannot sign in.</span>
                </span>
              </label>
            }
          </div>

          <footer>
            <button class="btn" type="button" (click)="editing.set(null)">Cancel</button>
            <button class="btn primary" type="button" (click)="save()" [disabled]="saving()">
              @if (saving()) { <span class="spinner"></span> }
              {{ user.id ? 'Save changes' : 'Create user' }}
            </button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [`
    .ladder { display: flex; flex-wrap: wrap; gap: 8px; }
    .rung {
      flex: 1 1 190px;
      padding: 9px 11px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .rung strong { font-size: 12.5px; }
    .rung span { font-size: 11.5px; color: var(--text-muted); line-height: 1.45; }
  `]
})
export class UsersComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly users = signal<AppUser[]>([]);
  readonly editing = signal<Partial<AppUser> | null>(null);
  readonly saving = signal(false);

  readonly roles = ROLES;
  readonly levels = CLASSIFICATIONS;

  form = {
    displayName: '', email: '', role: 'User' as Role, maxClassification: 'Internal',
    department: '', password: '', isActive: true
  };

  constructor() {
    this.load();
  }

  load(): void {
    this.api.users().subscribe({
      next: list => this.users.set(list),
      error: err => this.toast.error(apiMessage(err, 'Could not load users.'))
    });
  }

  assignableRoles() {
    return ROLES.filter(role => this.auth.hasRole(role.value));
  }

  startCreate(): void {
    this.form = {
      displayName: '', email: '', role: 'User', maxClassification: 'Internal',
      department: '', password: '', isActive: true
    };
    this.editing.set({});
  }

  startEdit(user: AppUser): void {
    this.form = {
      displayName: user.displayName, email: user.email, role: user.role,
      maxClassification: user.maxClassification, department: user.department ?? '',
      password: '', isActive: user.isActive
    };
    this.editing.set(user);
  }

  save(): void {
    const current = this.editing();
    if (!current) return;

    this.saving.set(true);
    const done = {
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.load();
        this.toast.success('User saved.');
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.toast.error(apiMessage(err));
      }
    };

    if (current.id) {
      this.api.updateUser(current.id, {
        displayName: this.form.displayName,
        role: this.form.role,
        department: this.form.department,
        maxClassification: this.form.maxClassification,
        isActive: this.form.isActive,
        ...(this.form.password ? { password: this.form.password } : {})
      }).subscribe(done);
    } else {
      if (!this.form.email.trim() || !this.form.password) {
        this.saving.set(false);
        this.toast.error('Email and password are required.');
        return;
      }
      this.api.createUser({
        email: this.form.email.trim(),
        displayName: this.form.displayName || this.form.email.trim(),
        password: this.form.password,
        role: this.form.role,
        department: this.form.department,
        maxClassification: this.form.maxClassification
      }).subscribe(done);
    }
  }

  remove(user: AppUser): void {
    if (!confirm(`Delete ${user.email}?`)) return;
    this.api.deleteUser(user.id).subscribe({
      next: () => {
        this.toast.success('User deleted.');
        this.load();
      },
      error: err => this.toast.error(apiMessage(err))
    });
  }
}
