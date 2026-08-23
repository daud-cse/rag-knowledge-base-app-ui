import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, Input, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { apiMessage } from '../../core/http';
import { ToastService } from '../../core/toast.service';
import { CLASSIFICATIONS, Chunk, DocumentItem, KnowledgeBase } from '../../core/models';

const PIPELINE = ['Uploaded', 'Validating', 'Extracting', 'Chunking', 'Embedding', 'Indexed'];

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <a routerLink="/admin/knowledge" class="small">← Knowledge bases</a>
          <h1 style="margin-top:4px">{{ kb()?.name || 'Documents' }}</h1>
          <p class="subtitle">
            Upload runs a pipeline: validate → extract text → chunk → embed → index. Status here is
            the live state of that pipeline.
          </p>
        </div>
        @if (canManage()) {
          <button class="btn primary" type="button" (click)="picker.click()">⭱ Upload documents</button>
          <input #picker type="file" multiple hidden (change)="upload($event)"
                 accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.json,.html,.htm,.log,.xml" />
        }
      </div>

      @if (canManage()) {
        <div class="card" style="margin-bottom:16px">
          <div class="card-body tight row wrap">
            <span class="label" style="margin:0">Classification for new uploads</span>
            <select style="width:auto" [(ngModel)]="classification" name="classification">
              @for (level of levels; track level) {
                <option [value]="level" [disabled]="!allowed(level)">{{ level }}</option>
              }
            </select>
            <span class="muted small">
              A document is only retrievable by users whose clearance is at least its classification.
              Yours is <strong>{{ auth.user()?.maxClassification }}</strong>.
            </span>
          </div>
        </div>
      }

      <div class="card">
        <div class="card-head">
          <h2>Documents</h2>
          <span class="row">
            <select style="width:auto" [ngModel]="statusFilter()" (ngModelChange)="filter($event)" name="status">
              <option value="">All statuses</option>
              @for (status of allStatuses; track status) { <option [value]="status">{{ status }}</option> }
            </select>
            <button class="btn sm" type="button" (click)="load()">↻ Refresh</button>
          </span>
        </div>

        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Document</th>
                <th>Status</th>
                <th>Chunks</th>
                <th>Class</th>
                <th>Version</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (doc of documents(); track doc.id) {
                <tr>
                  <td>
                    <strong>{{ doc.fileName }}</strong>
                    @if (doc.errorMessage) {
                      <div class="small" style="color:var(--danger)">{{ doc.errorMessage }}</div>
                    }
                  </td>
                  <td>
                    <span class="badge" [class.good]="doc.status === 'Indexed'"
                          [class.bad]="doc.status === 'Failed'"
                          [class.warn]="inFlight(doc.status)">
                      <span class="dot"></span>{{ doc.status }}
                    </span>
                    @if (inFlight(doc.status)) {
                      <div class="pipeline">
                        @for (step of pipeline; track step) {
                          <span class="step" [class.done]="stepIndex(doc.status) >= stepIndex(step)"></span>
                        }
                      </div>
                    }
                  </td>
                  <td class="mono">{{ doc.chunkCount | number }}</td>
                  <td><span class="badge">{{ doc.classification }}</span></td>
                  <td class="mono">v{{ doc.version }}</td>
                  <td class="mono">{{ size(doc.sizeBytes) }}</td>
                  <td class="small">
                    {{ doc.createdAt | date: 'MMM d, HH:mm' }}<br />
                    <span class="muted">{{ doc.uploadedBy }}</span>
                  </td>
                  <td class="actions">
                    <button class="btn ghost sm" type="button" (click)="viewChunks(doc)">Chunks</button>
                    <button class="btn ghost sm" type="button" (click)="download(doc)">Download</button>
                    @if (canManage()) {
                      <button class="btn ghost sm" type="button" (click)="reprocess(doc)">Re-index</button>
                      <button class="btn ghost sm" type="button" (click)="remove(doc)">Delete</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="8">
                  <div class="empty">
                    <span class="icon">📄</span>
                    No documents yet. Upload PDF, Word, Excel, PowerPoint, CSV, HTML or text files.
                  </div>
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    @if (chunkFor(); as doc) {
      <div class="modal-backdrop" (click)="chunkFor.set(null)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <header>
            <h2>Indexed chunks · {{ doc.fileName }}</h2>
            <button class="btn ghost sm" type="button" (click)="chunkFor.set(null)">✕</button>
          </header>
          <div class="body">
            <p class="muted small">
              These are the exact passages retrieval can return. Locator values become the page or
              section shown in a citation.
            </p>
            @for (chunk of chunks(); track chunk.id) {
              <div class="chunk">
                <div class="row">
                  <span class="badge brand">#{{ chunk.ordinal }}</span>
                  @if (chunk.locator) { <span class="badge">{{ chunk.locator }}</span> }
                  <span class="muted small">~{{ chunk.tokenEstimate }} tokens</span>
                </div>
                <p>{{ chunk.preview }}</p>
              </div>
            } @empty {
              <div class="empty">No chunks. The document has not been indexed yet.</div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .pipeline { display: flex; gap: 3px; margin-top: 5px; }
    .pipeline .step {
      width: 14px; height: 3px; border-radius: 2px; background: var(--border-strong);
    }
    .pipeline .step.done { background: var(--brand); }

    .chunk {
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 11px 13px;
      margin-bottom: 9px;
      background: var(--surface-2);
    }
    .chunk p { margin: 7px 0 0; font-size: 12.5px; line-height: 1.55; white-space: pre-wrap; }
  `]
})
export class DocumentsComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly kb = signal<KnowledgeBase | null>(null);
  readonly documents = signal<DocumentItem[]>([]);
  readonly chunks = signal<Chunk[]>([]);
  readonly chunkFor = signal<DocumentItem | null>(null);
  readonly statusFilter = signal('');

  readonly levels = CLASSIFICATIONS;
  readonly pipeline = PIPELINE;
  readonly allStatuses = [...PIPELINE, 'Failed', 'Archived'];
  classification = 'Internal';

  private knowledgeBaseId = '';
  private pollTimer?: ReturnType<typeof setTimeout>;

  @Input()
  set id(value: string) {
    this.knowledgeBaseId = value;
    this.api.knowledgeBase(value).subscribe({
      next: kb => this.kb.set(kb),
      error: err => this.toast.error(apiMessage(err, 'Knowledge base not found.'))
    });
    this.load();
  }

  load(): void {
    this.api.documents(this.knowledgeBaseId, this.statusFilter() || undefined).subscribe({
      next: docs => {
        this.documents.set(docs);
        this.schedulePoll(docs);
      },
      error: err => this.toast.error(apiMessage(err, 'Could not load documents.'))
    });
  }

  filter(status: string): void {
    this.statusFilter.set(status);
    this.load();
  }

  /** Ingestion runs in the background, so refresh while anything is still in the pipeline. */
  private schedulePoll(docs: DocumentItem[]): void {
    clearTimeout(this.pollTimer);
    if (docs.some(d => this.inFlight(d.status))) {
      this.pollTimer = setTimeout(() => this.load(), 1500);
    }
  }

  canManage(): boolean {
    const kb = this.kb();
    if (!kb) return false;
    return kb.scope === 'Company'
      ? this.auth.hasRole('KnowledgeAdmin')
      : kb.ownerUserId === this.auth.user()?.id;
  }

  allowed(level: string): boolean {
    const mine = this.auth.user()?.maxClassification;
    return !!mine && CLASSIFICATIONS.indexOf(level as any) <= CLASSIFICATIONS.indexOf(mine);
  }

  inFlight(status: string): boolean {
    return PIPELINE.includes(status) && status !== 'Indexed';
  }

  stepIndex(status: string): number {
    return PIPELINE.indexOf(status);
  }

  upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;

    this.api.uploadDocuments(this.knowledgeBaseId, this.classification, files).subscribe({
      next: created => {
        this.toast.success(`${created.length} document(s) queued for indexing.`);
        this.load();
      },
      error: err => this.toast.error(apiMessage(err, 'Upload failed.'))
    });
    input.value = '';
  }

  viewChunks(doc: DocumentItem): void {
    this.chunkFor.set(doc);
    this.chunks.set([]);
    this.api.documentChunks(doc.id).subscribe({
      next: list => this.chunks.set(list),
      error: err => this.toast.error(apiMessage(err))
    });
  }

  download(doc: DocumentItem): void {
    this.api.downloadDocument(doc.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.fileName;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: err => this.toast.error(apiMessage(err))
    });
  }

  reprocess(doc: DocumentItem): void {
    this.api.reprocessDocument(doc.id).subscribe({
      next: () => {
        this.toast.info(`Re-indexing ${doc.fileName}…`);
        this.load();
      },
      error: err => this.toast.error(apiMessage(err))
    });
  }

  remove(doc: DocumentItem): void {
    if (!confirm(`Delete "${doc.fileName}" and its index entries?`)) return;
    this.api.deleteDocument(doc.id).subscribe({
      next: () => {
        this.toast.success('Document deleted.');
        this.load();
      },
      error: err => this.toast.error(apiMessage(err))
    });
  }

  size(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
