import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { apiMessage } from '../../core/http';
import { ToastService } from '../../core/toast.service';
import { Tenant } from '../../core/models';

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Workspaces</h1>
          <p class="subtitle">
            Every workspace is an isolated tenant, whether it is a company with many employees or one
            person's private space. Users, chatbots, knowledge bases, documents and vectors all carry
            a tenant id, and retrieval filters on it before anything reaches a model — so no
            workspace can ever read another's content.
          </p>
        </div>
        <button class="btn primary" type="button" (click)="creating.set(true)">＋ New company</button>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Workspace</th><th>Type</th><th>Slug</th><th>SSO email domains</th><th>Users</th>
                <th>Chatbots</th><th>Knowledge bases</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (tenant of tenants(); track tenant.id) {
                <tr>
                  <td>
                    <strong>{{ tenant.name }}</strong>
                    <div class="muted small">{{ tenant.description || '—' }}</div>
                  </td>
                  <td>
                    <span class="badge" [class.brand]="tenant.type === 'Company'">
                      {{ tenant.type === 'Company' ? '🏢 Company' : '👤 Personal' }}
                    </span>
                  </td>
                  <td class="mono">{{ tenant.slug }}</td>
                  <td>
                    @if (tenant.type === 'Personal') {
                      <span class="muted small">n/a</span>
                    } @else if (tenant.allowedEmailDomains) {
                      @for (domain of domains(tenant); track domain) {
                        <span class="badge brand">{{ domain }}</span>
                      }
                    } @else {
                      <span class="muted small">none</span>
                    }
                  </td>
                  <td class="mono">{{ tenant.userCount }}</td>
                  <td class="mono">{{ tenant.chatbotCount }}</td>
                  <td class="mono">{{ tenant.knowledgeBaseCount }}</td>
                  <td>
                    <span class="badge" [class.good]="tenant.isActive" [class.warn]="!tenant.isActive">
                      {{ tenant.isActive ? 'Active' : 'Suspended' }}
                    </span>
                  </td>
                  <td class="actions">
                    <button class="btn ghost sm" type="button" (click)="edit(tenant)">Edit</button>
                    <button class="btn ghost sm" type="button" (click)="toggle(tenant)">
                      {{ tenant.isActive ? 'Suspend' : 'Activate' }}
                    </button>
                    <button class="btn ghost sm" type="button" (click)="remove(tenant)">Delete</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="9"><div class="empty">No workspaces yet.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    @if (creating()) {
      <div class="modal-backdrop" (click)="close()">
        <div class="modal" (click)="$event.stopPropagation()">
          <header>
            <h2>{{ editingId() ? 'Edit company' : 'New company' }}</h2>
            <button class="btn ghost sm" type="button" (click)="close()">✕</button>
          </header>

          <div class="body">
            <div class="grid cols-2">
              <label class="field">
                <span class="label">Company name</span>
                <input type="text" [(ngModel)]="form.name" name="name" placeholder="Northwind Insurance" />
              </label>
              <label class="field">
                <span class="label">Slug</span>
                <input type="text" [(ngModel)]="form.slug" name="slug" placeholder="northwind" />
                <span class="hint">Lower-case identifier used in storage and index keys.</span>
              </label>
            </div>

            <label class="field">
              <span class="label">Description</span>
              <input type="text" [(ngModel)]="form.description" name="description" />
            </label>

            <label class="field">
              <span class="label">Allowed email domains (SSO)</span>
              <input type="text" [(ngModel)]="form.allowedEmailDomains" name="allowedEmailDomains"
                     placeholder="contoso.com, contoso-health.com" />
              <span class="hint">
                Someone signing in with Google or Microsoft whose email ends in one of these domains
                is placed into this company as a normal User. Leave empty to require that an
                administrator creates the account first.
              </span>
            </label>

            @if (!editingId()) {
              <h3 style="margin:16px 0 10px">First company administrator</h3>
            }
            @if (!editingId()) {
              <div class="grid cols-2">
                <label class="field">
                  <span class="label">Email</span>
                  <input type="email" [(ngModel)]="form.adminEmail" name="adminEmail" />
                </label>
                <label class="field">
                  <span class="label">Password</span>
                  <input type="password" [(ngModel)]="form.adminPassword" name="adminPassword"
                         autocomplete="new-password" />
                </label>
              </div>
              <label class="field">
                <span class="label">Display name</span>
                <input type="text" [(ngModel)]="form.adminDisplayName" name="adminDisplayName" />
              </label>
            }
          </div>

          <footer>
            <button class="btn" type="button" (click)="close()">Cancel</button>
            <button class="btn primary" type="button" (click)="save()" [disabled]="saving()">
              @if (saving()) { <span class="spinner"></span> }
              {{ editingId() ? 'Save changes' : 'Create company' }}
            </button>
          </footer>
        </div>
      </div>
    }
  `
})
export class TenantsComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly tenants = signal<Tenant[]>([]);
  readonly creating = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);

  form = this.blank();

  constructor() {
    this.load();
  }

  private blank() {
    return {
      name: '', slug: '', description: '', allowedEmailDomains: '',
      adminEmail: '', adminPassword: '', adminDisplayName: ''
    };
  }

  domains(tenant: Tenant): string[] {
    return (tenant.allowedEmailDomains ?? '').split(',').map(d => d.trim()).filter(Boolean);
  }

  edit(tenant: Tenant): void {
    this.form = {
      ...this.blank(),
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description ?? '',
      allowedEmailDomains: tenant.allowedEmailDomains ?? ''
    };
    this.editingId.set(tenant.id);
    this.creating.set(true);
  }

  close(): void {
    this.creating.set(false);
    this.editingId.set(null);
    this.form = this.blank();
  }

  save(): void {
    const id = this.editingId();
    if (id) this.update(id);
    else this.create();
  }

  private update(id: string): void {
    this.saving.set(true);
    this.api.updateTenant(id, {
      name: this.form.name.trim(),
      slug: this.form.slug.trim().toLowerCase(),
      description: this.form.description || null,
      allowedEmailDomains: this.form.allowedEmailDomains || null
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.close();
        this.load();
        this.toast.success('Company updated.');
      },
      error: err => {
        this.saving.set(false);
        this.toast.error(apiMessage(err));
      }
    });
  }

  load(): void {
    this.api.tenants().subscribe({
      next: list => this.tenants.set(list),
      error: err => this.toast.error(apiMessage(err, 'Could not load companies.'))
    });
  }

  private create(): void {
    if (!this.form.name.trim() || !this.form.slug.trim()) {
      this.toast.error('Name and slug are required.');
      return;
    }
    this.saving.set(true);
    this.api.createTenant({
      name: this.form.name.trim(),
      slug: this.form.slug.trim().toLowerCase(),
      description: this.form.description || null,
      allowedEmailDomains: this.form.allowedEmailDomains || null,
      adminEmail: this.form.adminEmail || null,
      adminPassword: this.form.adminPassword || null,
      adminDisplayName: this.form.adminDisplayName || null
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.close();
        this.load();
        this.toast.success('Company created.');
      },
      error: err => {
        this.saving.set(false);
        this.toast.error(apiMessage(err));
      }
    });
  }

  toggle(tenant: Tenant): void {
    this.api.toggleTenant(tenant.id).subscribe({
      next: () => this.load(),
      error: err => this.toast.error(apiMessage(err))
    });
  }

  remove(tenant: Tenant): void {
    if (!confirm(`Delete "${tenant.name}" and every user, chatbot and document inside it?`)) return;
    this.api.deleteTenant(tenant.id).subscribe({
      next: () => {
        this.toast.success('Company deleted.');
        this.load();
      },
      error: err => this.toast.error(apiMessage(err))
    });
  }
}
