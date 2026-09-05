import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { apiMessage } from '../../core/http';
import { ToastService } from '../../core/toast.service';
import { Tool, ToolInvocation, ToolOperation } from '../../core/models';

type Tab = 'Api' | 'Mcp' | 'Connector';

@Component({
  selector: 'app-tools',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>🔧 Tools</h1>
          <p class="subtitle">
            Connect APIs, MCP servers and third-party connectors so assistants can take actions.
            A tool is only reachable once it is attached to a chatbot, and anything that writes
            waits for a person unless you say otherwise.
          </p>
        </div>
        <div class="row">
          @if (tab() === 'Mcp') {
            <button class="btn" type="button" (click)="showImport.set(true)">Import from JSON</button>
          }
          @if (tab() !== 'Connector') {
            <button class="btn primary" type="button" (click)="startCreate()">＋ Add</button>
          }
        </div>
      </div>

      <div class="tabs">
        @for (t of tabs; track t.key) {
          <button class="tab" type="button" [class.active]="tab() === t.key" (click)="tab.set(t.key)">
            {{ t.label }} <span class="count">{{ countOf(t.key) }}</span>
          </button>
        }
      </div>

      @if (pending().length > 0) {
        <div class="card approval">
          <div class="card-head">
            <strong>{{ pending().length }} action{{ pending().length === 1 ? '' : 's' }} waiting for approval</strong>
            <span class="muted small">An assistant asked to do something that changes data.</span>
          </div>
          @for (p of pending(); track p.id) {
            <div class="pending-row">
              <div style="flex:1;min-width:0">
                <strong>{{ p.toolName }}.{{ p.operationName }}</strong>
                <div class="muted small mono truncate">{{ p.argumentsJson }}</div>
                <div class="muted small">Asked by {{ p.userEmail }} · {{ p.createdAt | date: 'MMM d, HH:mm' }}</div>
              </div>
              <div class="row">
                <button class="btn sm" type="button" (click)="reject(p)">Reject</button>
                <button class="btn primary sm" type="button" (click)="approve(p)">Approve &amp; run</button>
              </div>
            </div>
          }
        </div>
      }

      @if (visible().length === 0) {
        <div class="card">
          <div class="empty-tool">
            <p>{{ emptyText() }}</p>
            <ol>
              <li>Click Add</li>
              <li>Configure connection details and authentication</li>
              <li>Attach the tool to a chatbot, then use it from chat</li>
            </ol>
            @if (tab() === 'Connector') {
              <p class="muted small">
                Connectors reach third-party applications through a connector provider. The platform
                models them, but connecting one needs a provider account that is not configured on
                this deployment.
              </p>
            }
          </div>
        </div>
      } @else {
        <div class="grid cols-2">
          @for (tool of visible(); track tool.id) {
            <div class="card tool">
              <div class="card-body">
                <div class="row" style="align-items:flex-start">
                  <div style="flex:1;min-width:0">
                    <h3 class="truncate">{{ tool.name }}</h3>
                    <p class="muted small" style="margin:3px 0 0">{{ tool.description }}</p>
                  </div>
                  <span class="badge" [class.bad]="!tool.isActive">
                    {{ tool.isActive ? tool.type : 'disabled' }}
                  </span>
                </div>

                <div class="chips">
                  <span class="badge">{{ approvalLabel(tool.humanApproval) }}</span>
                  @if (tool.hasSecret) { <span class="badge">credential set</span> }
                  <span class="badge">{{ tool.operations.length }} operation{{ tool.operations.length === 1 ? '' : 's' }}</span>
                </div>

                @if (tool.baseUrl) {
                  <div class="muted small mono truncate" style="margin-top:8px">{{ tool.baseUrl }}</div>
                }
                @if (tool.lastError) {
                  <div class="error small" style="margin-top:8px">{{ tool.lastError }}</div>
                }

                @if (tool.operations.length > 0) {
                  <div class="ops">
                    @for (op of tool.operations; track op.id) {
                      <div class="op">
                        <span class="mono">{{ op.name }}</span>
                        <span class="badge sm" [class.brand]="op.isReadOnly">
                          {{ op.isReadOnly ? 'read' : 'write' }}
                        </span>
                        @if (op.httpMethod) { <span class="muted small mono">{{ op.httpMethod }} {{ op.path }}</span> }
                        @if (tool.type === 'Api') {
                          <button class="btn ghost sm" type="button" title="Remove operation"
                                  (click)="removeOperation(tool, op)">🗑</button>
                        }
                      </div>
                    }
                  </div>
                }
              </div>

              <div class="card-foot">
                @if (tool.type === 'Api') {
                  <button class="btn sm" type="button" (click)="startOperation(tool)">＋ Operation</button>
                }
                @if (tool.type === 'Mcp') {
                  <button class="btn sm" type="button" (click)="refresh(tool)">↻ Refresh tools</button>
                }
                <button class="btn ghost sm" type="button" (click)="remove(tool)">Delete</button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- ------------------------------ add tool ------------------------------ -->
    @if (editing()) {
      <div class="modal-backdrop" (click)="editing.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <header>
            <h2>{{ tab() === 'Mcp' ? 'Add MCP server' : 'Add tool' }}</h2>
            <button class="btn ghost sm" type="button" (click)="editing.set(false)">✕</button>
          </header>

          <div class="body">
            <label class="field">
              <span class="label">Tool name</span>
              <input type="text" [(ngModel)]="form.name" name="name" placeholder="order_lookup" />
              <span class="hint">Letters, numbers and underscores. The model sees this name.</span>
            </label>

            <label class="field">
              <span class="label">{{ tab() === 'Mcp' ? 'Server URL' : 'Base URL' }}</span>
              <input type="text" [(ngModel)]="form.baseUrl" name="baseUrl"
                     placeholder="https://api.example.com" />
            </label>

            <label class="field">
              <span class="label">Description</span>
              <textarea [(ngModel)]="form.description" name="description" rows="3"
                        placeholder="What this tool does, and when the assistant should reach for it."></textarea>
              <span class="hint">The model reads this to decide whether the tool is relevant, so be specific.</span>
            </label>

            <div class="grid cols-2">
              <label class="field">
                <span class="label">Authentication</span>
                <select [(ngModel)]="form.authType" name="authType">
                  <option value="None">None</option>
                  <option value="BearerToken">Bearer token</option>
                  <option value="ApiKeyHeader">API key header</option>
                </select>
              </label>
              @if (form.authType === 'ApiKeyHeader') {
                <label class="field">
                  <span class="label">Header name</span>
                  <input type="text" [(ngModel)]="form.authHeaderName" name="hdr" placeholder="X-Api-Key" />
                </label>
              }
            </div>

            @if (form.authType !== 'None') {
              <label class="field">
                <span class="label">Secret</span>
                <input type="password" [(ngModel)]="form.authSecret" name="secret"
                       placeholder="Stored server-side and never sent back to the browser" />
              </label>
            }

            <label class="field">
              <span class="label">Human approval</span>
              <select [(ngModel)]="form.humanApproval" name="approval">
                <option value="Auto">Auto — reads run, writes wait for a person</option>
                <option value="Always">Always — every call waits</option>
                <option value="Never">Never — nothing waits</option>
              </select>
            </label>
          </div>

          <footer>
            <button class="btn" type="button" (click)="editing.set(false)">Cancel</button>
            <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">Create</button>
          </footer>
        </div>
      </div>
    }

    <!-- --------------------------- add operation ---------------------------- -->
    @if (operationFor(); as tool) {
      <div class="modal-backdrop" (click)="operationFor.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <header>
            <h2>Operation on {{ tool.name }}</h2>
            <button class="btn ghost sm" type="button" (click)="operationFor.set(null)">✕</button>
          </header>

          <div class="body">
            <div class="grid cols-2">
              <label class="field">
                <span class="label">Name</span>
                <input type="text" [(ngModel)]="opForm.name" name="opname" placeholder="get_order" />
              </label>
              <label class="field">
                <span class="label">Method</span>
                <select [(ngModel)]="opForm.httpMethod" name="method">
                  <option>GET</option><option>POST</option><option>PUT</option>
                  <option>PATCH</option><option>DELETE</option>
                </select>
              </label>
            </div>

            <label class="field">
              <span class="label">Path</span>
              <input type="text" [(ngModel)]="opForm.path" name="path" placeholder="/orders/{id}" />
              <span class="hint">Values in braces are filled from the arguments the model supplies.</span>
            </label>

            <label class="field">
              <span class="label">Description</span>
              <input type="text" [(ngModel)]="opForm.description" name="opdesc"
                     placeholder="Look up one order by its id." />
            </label>

            <label class="field">
              <span class="label">Parameters (JSON Schema)</span>
              <textarea [(ngModel)]="opForm.parametersJson" name="schema" rows="7" class="mono"></textarea>
              <span class="hint">Passed to the model verbatim. Anything not used in the path becomes a query parameter or body field.</span>
            </label>
          </div>

          <footer>
            <button class="btn" type="button" (click)="operationFor.set(null)">Cancel</button>
            <button class="btn primary" type="button" [disabled]="busy()" (click)="saveOperation()">Add</button>
          </footer>
        </div>
      </div>
    }

    <!-- --------------------------- import from JSON -------------------------- -->
    @if (showImport()) {
      <div class="modal-backdrop" (click)="showImport.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <header>
            <h2>Import from JSON</h2>
            <button class="btn ghost sm" type="button" (click)="showImport.set(false)">✕</button>
          </header>

          <div class="body">
            <p class="muted small">
              Paste a Claude-style <code>mcpServers</code> block. Every remote server becomes its own
              MCP tool. Servers that run a local command are not supported.
            </p>
            <label class="field">
              <span class="label">Configuration</span>
              <textarea [(ngModel)]="importJson" name="import" rows="10" class="mono"></textarea>
            </label>
          </div>

          <footer>
            <button class="btn" type="button" (click)="showImport.set(false)">Cancel</button>
            <button class="btn primary" type="button" [disabled]="busy()" (click)="importMcp()">Import</button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [`
    .tabs { display: flex; gap: 8px; margin: 4px 0 18px; }
    .tab {
      font: inherit; padding: 7px 15px; border-radius: 999px; cursor: pointer;
      border: 1px solid var(--border-strong); background: var(--surface); color: var(--text);
    }
    .tab.active { background: var(--brand); border-color: var(--brand); color: #fff; }
    .tab .count { opacity: .65; margin-left: 4px; font-variant-numeric: tabular-nums; }

    .empty-tool { padding: 26px 24px; }
    .empty-tool ol { margin: 10px 0 14px; padding-left: 20px; color: var(--text-muted); font-size: 14px; }

    .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
    .ops { margin-top: 11px; border-top: 1px solid var(--border); padding-top: 9px; }
    .op { display: flex; align-items: center; gap: 7px; padding: 3px 0; font-size: 13px; flex-wrap: wrap; }
    .card-foot { display: flex; gap: 7px; padding: 10px 14px; border-top: 1px solid var(--border); }

    .approval { border-color: var(--warn); margin-bottom: 16px; }
    .approval .card-head { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
    .pending-row {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      padding: 11px 14px; border-top: 1px solid var(--border);
    }
    textarea.mono { font-family: var(--mono); font-size: 12.5px; }
  `]
})
export class ToolsComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly tabs: { key: Tab; label: string }[] = [
    { key: 'Api', label: 'API' },
    { key: 'Mcp', label: 'MCP' },
    { key: 'Connector', label: 'Connector' }
  ];

  readonly tools = signal<Tool[]>([]);
  readonly pending = signal<ToolInvocation[]>([]);
  readonly tab = signal<Tab>('Api');
  readonly editing = signal(false);
  readonly operationFor = signal<Tool | null>(null);
  readonly showImport = signal(false);
  readonly busy = signal(false);

  readonly visible = computed(() => this.tools().filter(t => t.type === this.tab()));

  importJson = `{
  "mcpServers": {
    "my-server": {
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}`;

  form = this.blankForm();
  opForm = this.blankOperation();

  constructor() {
    this.load();
  }

  countOf(tab: Tab): number { return this.tools().filter(t => t.type === tab).length; }

  emptyText(): string {
    return this.tab() === 'Mcp'
      ? "You haven't created any MCP servers yet. Add one to extend what your assistants can do."
      : this.tab() === 'Connector'
        ? "You haven't created any connectors yet."
        : "You haven't created any tools yet. Add one to extend what your assistants can do.";
  }

  approvalLabel(mode: string): string {
    return mode === 'Always' ? 'always ask' : mode === 'Never' ? 'never ask' : 'ask before writes';
  }

  load(): void {
    this.api.tools().subscribe({
      next: t => this.tools.set(t),
      error: e => this.toast.error(apiMessage(e, 'Could not load tools.'))
    });
    this.api.toolInvocations('PendingApproval').subscribe({
      next: p => this.pending.set(p),
      error: () => undefined
    });
  }

  startCreate(): void {
    this.form = this.blankForm();
    this.editing.set(true);
  }

  save(): void {
    this.busy.set(true);
    this.api.createTool({ ...this.form, type: this.tab() }).subscribe({
      next: () => {
        this.toast.success(`${this.form.name} created.`);
        this.editing.set(false);
        this.busy.set(false);
        this.load();
      },
      error: e => {
        this.busy.set(false);
        this.toast.error(apiMessage(e, 'Could not create the tool.'));
      }
    });
  }

  startOperation(tool: Tool): void {
    this.opForm = this.blankOperation();
    this.operationFor.set(tool);
  }

  saveOperation(): void {
    const tool = this.operationFor();
    if (!tool) return;
    this.busy.set(true);
    this.api.addToolOperation(tool.id, this.opForm).subscribe({
      next: () => {
        this.toast.success('Operation added.');
        this.operationFor.set(null);
        this.busy.set(false);
        this.load();
      },
      error: e => {
        this.busy.set(false);
        this.toast.error(apiMessage(e, 'Could not add the operation.'));
      }
    });
  }

  removeOperation(tool: Tool, op: ToolOperation): void {
    if (!confirm(`Remove ${op.name} from ${tool.name}?`)) return;
    this.api.deleteToolOperation(tool.id, op.id).subscribe({
      next: () => this.load(),
      error: e => this.toast.error(apiMessage(e, 'Could not remove the operation.'))
    });
  }

  refresh(tool: Tool): void {
    this.api.refreshTool(tool.id).subscribe({
      next: () => { this.toast.success('Tool list refreshed.'); this.load(); },
      error: e => this.toast.error(apiMessage(e, 'Could not reach the server.'))
    });
  }

  remove(tool: Tool): void {
    if (!confirm(`Delete ${tool.name}? Assistants using it will lose access.`)) return;
    this.api.deleteTool(tool.id).subscribe({
      next: () => { this.toast.success(`${tool.name} removed.`); this.load(); },
      error: e => this.toast.error(apiMessage(e, 'Could not delete the tool.'))
    });
  }

  importMcp(): void {
    this.busy.set(true);
    this.api.importMcp(this.importJson).subscribe({
      next: r => {
        this.busy.set(false);
        this.showImport.set(false);
        this.toast.success(`Imported ${r.imported} server${r.imported === 1 ? '' : 's'}.`);
        // Warnings are the useful half of an import: a skipped local server or an unreachable
        // endpoint is exactly what the person needs to know about.
        r.warnings.forEach(w => this.toast.error(w));
        this.load();
      },
      error: e => {
        this.busy.set(false);
        this.toast.error(apiMessage(e, 'Could not import that configuration.'));
      }
    });
  }

  approve(p: ToolInvocation): void {
    this.api.approveInvocation(p.id).subscribe({
      next: r => {
        this.toast.success(r.status === 'Succeeded'
          ? `${r.toolName}.${r.operationName} ran.`
          : `${r.toolName}.${r.operationName} failed: ${r.error}`);
        this.load();
      },
      error: e => this.toast.error(apiMessage(e, 'Could not run that action.'))
    });
  }

  reject(p: ToolInvocation): void {
    this.api.rejectInvocation(p.id).subscribe({
      next: () => { this.toast.success('Action rejected.'); this.load(); },
      error: e => this.toast.error(apiMessage(e, 'Could not reject that action.'))
    });
  }

  private blankForm() {
    return {
      name: '', description: '', baseUrl: '', authType: 'None',
      authHeaderName: '', authSecret: '', humanApproval: 'Auto', isActive: true
    };
  }

  private blankOperation() {
    return {
      name: '', description: '', httpMethod: 'GET', path: '',
      parametersJson: '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}',
      isReadOnly: false, isActive: true
    };
  }
}
