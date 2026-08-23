import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { apiMessage } from '../../core/http';
import { ToastService } from '../../core/toast.service';
import { KnowledgeBase } from '../../core/models';

@Component({
  selector: 'app-knowledge-bases',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Knowledge bases</h1>
          <p class="subtitle">
            Company knowledge bases are shared with everyone in {{ auth.user()?.tenantName }}.
            Personal knowledge bases are visible only to you and are searched alongside company
            content when you chat.
          </p>
        </div>
        <button class="btn primary" type="button" (click)="startCreate()">＋ New knowledge base</button>
      </div>

      @for (group of groups; track group.scope) {
        <h2 style="margin:22px 0 10px">{{ group.title }}</h2>
        <div class="grid cols-3">
          @for (kb of byScope(group.scope); track kb.id) {
            <div class="card kb">
              <div class="card-body">
                <div class="row" style="align-items:flex-start">
                  <div style="flex:1;min-width:0">
                    <h3 class="truncate">{{ kb.name }}</h3>
                    <p class="muted small" style="margin:3px 0 0">
                      {{ kb.description || 'No description' }}
                    </p>
                  </div>
                  @if (!kb.isActive) { <span class="badge warn">Disabled</span> }
                </div>

                <div class="kb-stats">
                  <span><strong>{{ kb.documentCount | number }}</strong> documents</span>
                  <span><strong>{{ kb.chunkCount | number }}</strong> chunks</span>
                </div>

                <p class="muted small" style="margin:0">
                  Chunk {{ kb.chunkSize }} / overlap {{ kb.chunkOverlap }} ·
                  {{ kb.embeddingModel }}<br />
                  @if (kb.lastIndexedAt) {
                    Last indexed {{ kb.lastIndexedAt | date: 'MMM d, y HH:mm' }}
                  } @else {
                    Never indexed
                  }
                </p>
              </div>
              <div class="card-head" style="border-top:1px solid var(--border);border-bottom:none">
                <a class="btn sm" [routerLink]="['/admin/knowledge', kb.id]">Open documents</a>
                <span class="row">
                  @if (canManage(kb)) {
                    <button class="btn ghost sm" type="button" (click)="startEdit(kb)">Settings</button>
                    <button class="btn ghost sm" type="button" (click)="remove(kb)">Delete</button>
                  }
                </span>
              </div>
            </div>
          } @empty {
            <div class="card"><div class="empty">
              <span class="icon">📚</span>
              {{ group.scope === 'Company' ? 'No company knowledge bases yet.' : 'You have no personal knowledge base yet.' }}
            </div></div>
          }
        </div>
      }
    </div>

    @if (editing(); as kb) {
      <div class="modal-backdrop" (click)="editing.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <header>
            <h2>{{ kb.id ? 'Knowledge base settings' : 'New knowledge base' }}</h2>
            <button class="btn ghost sm" type="button" (click)="editing.set(null)">✕</button>
          </header>

          <div class="body">
            <label class="field">
              <span class="label">Name</span>
              <input type="text" [(ngModel)]="form.name" name="name" placeholder="Healthcare Claims KB" />
            </label>

            <label class="field">
              <span class="label">Description</span>
              <textarea [(ngModel)]="form.description" name="description" rows="2"
                        placeholder="What lives in this knowledge base?"></textarea>
            </label>

            @if (!kb.id) {
              <label class="field">
                <span class="label">Scope</span>
                <select [(ngModel)]="form.scope" name="scope">
                  @if (auth.hasRole('KnowledgeAdmin')) {
                    <option value="Company">Company — shared with everyone in the tenant</option>
                  }
                  <option value="Personal">Personal — only you can see and search it</option>
                </select>
              </label>
            }

            <div class="grid cols-2">
              <label class="field">
                <span class="label">Chunk size (characters)</span>
                <input type="number" [(ngModel)]="form.chunkSize" name="chunkSize" min="200" max="8000" />
                <span class="hint">Larger chunks keep more context; smaller chunks retrieve more precisely.</span>
              </label>
              <label class="field">
                <span class="label">Chunk overlap</span>
                <input type="number" [(ngModel)]="form.chunkOverlap" name="chunkOverlap" min="0" max="2000" />
                <span class="hint">Carried between chunks so sentences are not cut in half.</span>
              </label>
            </div>

            <label class="field">
              <span class="label">Embedding model</span>
              <input type="text" [(ngModel)]="form.embeddingModel" name="embeddingModel" />
              <span class="hint">
                Applied to documents indexed from now on. Re-process existing documents to switch them over.
              </span>
            </label>

            @if (kb.id) {
              <label class="check">
                <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />
                <span class="check-text">
                  <strong>Active</strong>
                  <span>Disabled knowledge bases are excluded from retrieval.</span>
                </span>
              </label>
            }
          </div>

          <footer>
            <button class="btn" type="button" (click)="editing.set(null)">Cancel</button>
            <button class="btn primary" type="button" (click)="save()" [disabled]="saving()">
              @if (saving()) { <span class="spinner"></span> }
              {{ kb.id ? 'Save changes' : 'Create' }}
            </button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [`
    .kb { display: flex; flex-direction: column; }
    .kb .card-body { flex: 1; }
    .kb-stats {
      display: flex;
      gap: 16px;
      margin: 14px 0 10px;
      font-size: 12.5px;
      color: var(--text-muted);
    }
    .kb-stats strong { color: var(--text); font-size: 15px; margin-right: 3px; }
  `]
})
export class KnowledgeBasesComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly items = signal<KnowledgeBase[]>([]);
  readonly editing = signal<Partial<KnowledgeBase> | null>(null);
  readonly saving = signal(false);

  readonly groups = [
    { scope: 'Company' as const, title: 'Company knowledge' },
    { scope: 'Personal' as const, title: 'My knowledge' }
  ];

  form = {
    name: '', description: '', scope: 'Company',
    chunkSize: 900, chunkOverlap: 150, embeddingModel: 'text-embedding-3-small', isActive: true
  };

  constructor() {
    this.load();
  }

  load(): void {
    this.api.knowledgeBases().subscribe({
      next: list => this.items.set(list),
      error: err => this.toast.error(apiMessage(err, 'Could not load knowledge bases.'))
    });
  }

  byScope(scope: string): KnowledgeBase[] {
    return this.items().filter(kb => kb.scope === scope);
  }

  canManage(kb: KnowledgeBase): boolean {
    return kb.scope === 'Company'
      ? this.auth.hasRole('KnowledgeAdmin')
      : kb.ownerUserId === this.auth.user()?.id;
  }

  startCreate(): void {
    this.form = {
      name: '', description: '',
      scope: this.auth.hasRole('KnowledgeAdmin') ? 'Company' : 'Personal',
      chunkSize: 900, chunkOverlap: 150, embeddingModel: 'text-embedding-3-small', isActive: true
    };
    this.editing.set({});
  }

  startEdit(kb: KnowledgeBase): void {
    this.form = {
      name: kb.name, description: kb.description ?? '', scope: kb.scope,
      chunkSize: kb.chunkSize, chunkOverlap: kb.chunkOverlap,
      embeddingModel: kb.embeddingModel, isActive: kb.isActive
    };
    this.editing.set(kb);
  }

  save(): void {
    const current = this.editing();
    if (!current || !this.form.name.trim()) {
      this.toast.error('A name is required.');
      return;
    }
    this.saving.set(true);

    const done = {
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.load();
        this.toast.success('Knowledge base saved.');
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.toast.error(apiMessage(err));
      }
    };

    if (current.id) {
      this.api.updateKnowledgeBase(current.id, {
        name: this.form.name, description: this.form.description,
        chunkSize: this.form.chunkSize, chunkOverlap: this.form.chunkOverlap,
        embeddingModel: this.form.embeddingModel, isActive: this.form.isActive
      }).subscribe(done);
    } else {
      this.api.createKnowledgeBase({
        name: this.form.name, description: this.form.description, scope: this.form.scope,
        chunkSize: this.form.chunkSize, chunkOverlap: this.form.chunkOverlap,
        embeddingModel: this.form.embeddingModel
      }).subscribe(done);
    }
  }

  remove(kb: KnowledgeBase): void {
    if (!confirm(`Delete "${kb.name}"? Its documents and index entries are removed.`)) return;
    this.api.deleteKnowledgeBase(kb.id).subscribe({
      next: () => {
        this.toast.success('Knowledge base deleted.');
        this.load();
      },
      error: err => this.toast.error(apiMessage(err))
    });
  }
}
