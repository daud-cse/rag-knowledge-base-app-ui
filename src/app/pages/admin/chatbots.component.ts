import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { apiMessage } from '../../core/http';
import { ToastService } from '../../core/toast.service';
import { Chatbot, KnowledgeBase } from '../../core/models';

type Tab = 'general' | 'rag' | 'knowledge' | 'chat';

@Component({
  selector: 'app-chatbots',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Chatbots</h1>
          <p class="subtitle">
            Each chatbot has its own prompt, model settings, retrieval configuration and set of
            knowledge bases. A chatbot can only ever read knowledge bases in its own company.
          </p>
        </div>
        <button class="btn primary" type="button" (click)="startCreate()">＋ New chatbot</button>
      </div>

      <div class="grid cols-2">
        @for (bot of bots(); track bot.id) {
          <div class="card bot">
            <div class="card-body">
              <div class="row" style="align-items:flex-start">
                <span class="face">🤖</span>
                <div style="flex:1;min-width:0">
                  <h3 class="truncate">{{ bot.name }}</h3>
                  <p class="muted small" style="margin:2px 0 0">{{ bot.description || 'No description' }}</p>
                </div>
                <span class="badge" [class.good]="bot.isActive" [class.warn]="!bot.isActive">
                  {{ bot.isActive ? 'Active' : 'Disabled' }}
                </span>
              </div>

              <div class="chips">
                <span class="badge">{{ bot.model }}</span>
                <span class="badge">temp {{ bot.temperature }}</span>
                <span class="badge">max {{ bot.maxTokens }} tok</span>
                @if (bot.ragEnabled) {
                  <span class="badge brand">RAG top-K {{ bot.topK }} → {{ bot.rerankTopN }}</span>
                } @else {
                  <span class="badge warn">RAG off</span>
                }
                @if (bot.citationsEnabled) { <span class="badge good">Citations</span> }
              </div>

              <p class="label" style="margin:14px 0 5px">Knowledge bases</p>
              <div class="chips">
                @for (kb of bot.knowledgeBases; track kb.knowledgeBaseId) {
                  <span class="badge brand">{{ kb.priority }}. {{ kb.name }}</span>
                } @empty {
                  <span class="muted small">None mapped — this chatbot has nothing to retrieve from.</span>
                }
              </div>
            </div>
            <div class="card-head" style="border-top:1px solid var(--border);border-bottom:none">
              <button class="btn sm" type="button" (click)="edit(bot)">Configure</button>
              <button class="btn ghost sm" type="button" (click)="remove(bot)">Delete</button>
            </div>
          </div>
        } @empty {
          <div class="card"><div class="empty">
            <span class="icon">🤖</span>No chatbots yet.
          </div></div>
        }
      </div>
    </div>

    @if (editing(); as bot) {
      <div class="modal-backdrop" (click)="close()">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <header>
            <h2>{{ bot.id ? 'Configure ' + bot.name : 'New chatbot' }}</h2>
            <button class="btn ghost sm" type="button" (click)="close()">✕</button>
          </header>

          <div class="tabs">
            @for (t of tabs; track t.key) {
              <button type="button" [class.active]="tab() === t.key" (click)="tab.set(t.key)">
                {{ t.label }}
              </button>
            }
          </div>

          <div class="body">
            @switch (tab()) {
              @case ('general') {
                <label class="field">
                  <span class="label">Name</span>
                  <input type="text" [(ngModel)]="form.name" name="name" placeholder="Healthcare Claims Assistant" />
                </label>
                <label class="field">
                  <span class="label">Description</span>
                  <input type="text" [(ngModel)]="form.description" name="description" />
                </label>
                <label class="field">
                  <span class="label">System prompt</span>
                  <textarea [(ngModel)]="form.systemPrompt" name="systemPrompt" rows="5"></textarea>
                  <span class="hint">
                    Retrieval context and the citation instruction are appended automatically when RAG is on.
                  </span>
                </label>

                <div class="grid cols-3">
                  <label class="field">
                    <span class="label">Model</span>
                    <input type="text" [(ngModel)]="form.model" name="model" />
                  </label>
                  <label class="field">
                    <span class="label">Temperature — {{ form.temperature }}</span>
                    <input type="range" min="0" max="1" step="0.05"
                           [(ngModel)]="form.temperature" name="temperature" />
                    <span class="hint">Low values keep answers close to the source text.</span>
                  </label>
                  <label class="field">
                    <span class="label">Max response tokens</span>
                    <input type="number" [(ngModel)]="form.maxTokens" name="maxTokens" min="64" max="8000" />
                  </label>
                </div>

                <label class="check">
                  <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />
                  <span class="check-text">
                    <strong>Active</strong><span>Disabled chatbots disappear from the chat picker.</span>
                  </span>
                </label>
              }

              @case ('rag') {
                <label class="check">
                  <input type="checkbox" [(ngModel)]="form.ragEnabled" name="ragEnabled" />
                  <span class="check-text">
                    <strong>Enable retrieval-augmented generation</strong>
                    <span>Off means the model answers without your documents.</span>
                  </span>
                </label>
                <label class="check">
                  <input type="checkbox" [(ngModel)]="form.citationsEnabled" name="citationsEnabled" />
                  <span class="check-text">
                    <strong>Show citations</strong>
                    <span>Answers carry numbered markers linked to the source passage.</span>
                  </span>
                </label>
                <label class="check">
                  <input type="checkbox" [(ngModel)]="form.hybridSearch" name="hybridSearch" />
                  <span class="check-text">
                    <strong>Hybrid search</strong>
                    <span>Blend vector similarity with keyword overlap. Helps with codes and identifiers.</span>
                  </span>
                </label>
                <label class="check">
                  <input type="checkbox" [(ngModel)]="form.queryRewriting" name="queryRewriting" />
                  <span class="check-text">
                    <strong>Query rewriting</strong>
                    <span>Expands short follow-up questions using the previous turn before searching.</span>
                  </span>
                </label>

                <div class="grid cols-3" style="margin-top:14px">
                  <label class="field">
                    <span class="label">Top-K candidates</span>
                    <input type="number" [(ngModel)]="form.topK" name="topK" min="1" max="100" />
                    <span class="hint">Retrieved before reranking.</span>
                  </label>
                  <label class="field">
                    <span class="label">Passages sent to the model</span>
                    <input type="number" [(ngModel)]="form.rerankTopN" name="rerankTopN" min="1" max="20" />
                    <span class="hint">Survivors of the rerank step.</span>
                  </label>
                  <label class="field">
                    <span class="label">Similarity threshold — {{ form.similarityThreshold }}</span>
                    <input type="range" min="0" max="0.9" step="0.05"
                           [(ngModel)]="form.similarityThreshold" name="similarityThreshold" />
                    <span class="hint">Higher means fewer, more confident matches.</span>
                  </label>
                </div>

                <div class="flow">
                  <span>Question</span><span>→</span>
                  <span [class.off]="!form.queryRewriting">Rewrite</span><span>→</span>
                  <span [class.off]="!form.hybridSearch">Hybrid search</span><span>→</span>
                  <span>Security trim</span><span>→</span>
                  <span>Top {{ form.topK }}</span><span>→</span>
                  <span>Rerank</span><span>→</span>
                  <span>Top {{ form.rerankTopN }}</span><span>→</span>
                  <span>LLM</span>
                </div>
              }

              @case ('knowledge') {
                <p class="muted small">
                  Pick the company knowledge bases this chatbot may search, and the order they are
                  offered to the retriever. Personal knowledge bases are never shared this way — they
                  are added automatically for their own owner at query time.
                </p>
                @for (kb of companyKbs(); track kb.id) {
                  <div class="kb-row">
                    <label class="check" style="margin:0;flex:1">
                      <input type="checkbox" [checked]="isMapped(kb.id)" (change)="toggleKb(kb.id)" />
                      <span class="check-text">
                        <strong>{{ kb.name }}</strong>
                        <span>{{ kb.documentCount }} documents · {{ kb.chunkCount }} chunks</span>
                      </span>
                    </label>
                    @if (isMapped(kb.id)) {
                      <label class="priority">
                        Priority
                        <input type="number" min="1" max="99" [value]="priorityOf(kb.id)"
                               (input)="setPriority(kb.id, $event)" />
                      </label>
                    }
                  </div>
                } @empty {
                  <div class="empty">No company knowledge bases exist yet.</div>
                }
              }

              @case ('chat') {
                <label class="field">
                  <span class="label">Welcome message</span>
                  <textarea [(ngModel)]="form.welcomeMessage" name="welcomeMessage" rows="2"></textarea>
                </label>
                <label class="field">
                  <span class="label">Suggested questions (one per line)</span>
                  <textarea [(ngModel)]="suggestedText" name="suggested" rows="4"></textarea>
                </label>

                <div class="grid cols-3">
                  <label class="field">
                    <span class="label">Response language</span>
                    <select [(ngModel)]="form.responseLanguage" name="responseLanguage">
                      <option value="auto">Match the question</option>
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="French">French</option>
                      <option value="German">German</option>
                      <option value="Bengali">Bengali</option>
                      <option value="Arabic">Arabic</option>
                    </select>
                  </label>
                  <label class="field">
                    <span class="label">Conversation timeout (minutes)</span>
                    <input type="number" [(ngModel)]="form.conversationTimeoutMinutes"
                           name="timeout" min="5" max="10080" />
                  </label>
                </div>

                <label class="check">
                  <input type="checkbox" [(ngModel)]="form.allowUserUpload" name="allowUserUpload" />
                  <span class="check-text">
                    <strong>Let users attach their own files</strong>
                    <span>Attachments stay private to one conversation and never join the company knowledge base.</span>
                  </span>
                </label>
                <label class="check">
                  <input type="checkbox" [(ngModel)]="form.keepChatHistory" name="keepChatHistory" />
                  <span class="check-text">
                    <strong>Keep conversation history</strong>
                    <span>Off keeps only the current exchange, for sensitive deployments.</span>
                  </span>
                </label>
              }
            }
          </div>

          <footer>
            <button class="btn" type="button" (click)="close()">Cancel</button>
            <button class="btn primary" type="button" (click)="save()" [disabled]="saving()">
              @if (saving()) { <span class="spinner"></span> }
              {{ bot.id ? 'Save changes' : 'Create chatbot' }}
            </button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [`
    .bot { display: flex; flex-direction: column; }
    .bot .card-body { flex: 1; }
    .face {
      width: 34px; height: 34px; flex: none;
      border-radius: 10px;
      background: linear-gradient(140deg, #4c6ef5, #7048e8);
      display: grid; place-items: center; font-size: 17px;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 12px; }

    .tabs {
      display: flex;
      gap: 2px;
      padding: 0 20px;
      border-bottom: 1px solid var(--border);
      background: var(--surface-2);
    }
    .tabs button {
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      padding: 10px 14px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-muted);
      cursor: pointer;
    }
    .tabs button:hover { color: var(--text); }
    .tabs button.active { color: var(--brand); border-bottom-color: var(--brand); }

    .kb-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      margin-bottom: 7px;
    }
    .priority { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
    .priority input { width: 62px; }

    .flow {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-top: 18px;
      padding: 12px 14px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-size: 11.5px;
      color: var(--text-muted);
    }
    .flow span:nth-child(odd) {
      background: var(--surface);
      border: 1px solid var(--border-strong);
      border-radius: 999px;
      padding: 3px 9px;
      color: var(--text);
      font-weight: 600;
    }
    .flow span.off { opacity: .4; text-decoration: line-through; }
  `]
})
export class ChatbotsComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly bots = signal<Chatbot[]>([]);
  readonly companyKbs = signal<KnowledgeBase[]>([]);
  readonly editing = signal<Partial<Chatbot> | null>(null);
  readonly saving = signal(false);
  readonly tab = signal<Tab>('general');

  readonly tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'rag', label: 'Retrieval' },
    { key: 'knowledge', label: 'Knowledge bases' },
    { key: 'chat', label: 'Chat experience' }
  ];

  form = this.blank();
  suggestedText = '';
  private mapping = new Map<string, number>();

  constructor() {
    this.load();
    this.api.knowledgeBases('Company').subscribe({
      next: list => this.companyKbs.set(list),
      error: () => undefined
    });
  }

  load(): void {
    this.api.chatbots().subscribe({
      next: list => this.bots.set(list),
      error: err => this.toast.error(apiMessage(err, 'Could not load chatbots.'))
    });
  }

  private blank() {
    return {
      name: '', description: '',
      systemPrompt: 'You are a helpful enterprise assistant. Answer only from the supplied context ' +
        'and always cite your sources.',
      model: 'gpt-4o-mini', temperature: 0.2, maxTokens: 800,
      ragEnabled: true, citationsEnabled: true, topK: 20, rerankTopN: 5,
      similarityThreshold: 0.15, hybridSearch: true, queryRewriting: true,
      responseLanguage: 'auto', welcomeMessage: 'Hello! How can I help you today?',
      allowUserUpload: true, conversationTimeoutMinutes: 60, keepChatHistory: true, isActive: true
    };
  }

  startCreate(): void {
    this.form = this.blank();
    this.suggestedText = '';
    this.mapping = new Map();
    this.tab.set('general');
    this.editing.set({});
  }

  edit(bot: Chatbot): void {
    this.form = {
      name: bot.name, description: bot.description ?? '', systemPrompt: bot.systemPrompt,
      model: bot.model, temperature: bot.temperature, maxTokens: bot.maxTokens,
      ragEnabled: bot.ragEnabled, citationsEnabled: bot.citationsEnabled, topK: bot.topK,
      rerankTopN: bot.rerankTopN, similarityThreshold: bot.similarityThreshold,
      hybridSearch: bot.hybridSearch, queryRewriting: bot.queryRewriting,
      responseLanguage: bot.responseLanguage, welcomeMessage: bot.welcomeMessage,
      allowUserUpload: bot.allowUserUpload,
      conversationTimeoutMinutes: bot.conversationTimeoutMinutes,
      keepChatHistory: bot.keepChatHistory, isActive: bot.isActive
    };
    this.suggestedText = bot.suggestedQuestions.join('\n');
    this.mapping = new Map(bot.knowledgeBases.map(kb => [kb.knowledgeBaseId, kb.priority]));
    this.tab.set('general');
    this.editing.set(bot);
  }

  close(): void {
    this.editing.set(null);
  }

  isMapped(id: string): boolean {
    return this.mapping.has(id);
  }

  priorityOf(id: string): number {
    return this.mapping.get(id) ?? 1;
  }

  toggleKb(id: string): void {
    if (this.mapping.has(id)) {
      this.mapping.delete(id);
    } else {
      this.mapping.set(id, this.mapping.size + 1);
    }
  }

  setPriority(id: string, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value) && value > 0) this.mapping.set(id, value);
  }

  save(): void {
    const current = this.editing();
    if (!current || !this.form.name.trim()) {
      this.toast.error('A name is required.');
      return;
    }
    this.saving.set(true);

    const payload: Partial<Chatbot> = {
      ...this.form,
      temperature: Number(this.form.temperature),
      similarityThreshold: Number(this.form.similarityThreshold),
      suggestedQuestions: this.suggestedText.split('\n').map(s => s.trim()).filter(Boolean)
    };

    const request = current.id
      ? this.api.updateChatbot(current.id, payload)
      : this.api.createChatbot(payload);

    request.subscribe({
      next: saved => this.applyMapping(saved),
      error: err => {
        this.saving.set(false);
        this.toast.error(apiMessage(err));
      }
    });
  }

  private applyMapping(bot: Chatbot): void {
    const links = [...this.mapping.entries()]
      .map(([knowledgeBaseId, priority]) => ({ knowledgeBaseId, name: '', priority }));

    this.api.mapKnowledgeBases(bot.id, links).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.load();
        this.toast.success('Chatbot saved.');
      },
      error: err => {
        this.saving.set(false);
        this.load();
        this.toast.error(apiMessage(err, 'Saved, but the knowledge-base mapping failed.'));
      }
    });
  }

  remove(bot: Chatbot): void {
    if (!confirm(`Delete "${bot.name}"? Conversations with this chatbot are removed too.`)) return;
    this.api.deleteChatbot(bot.id).subscribe({
      next: () => {
        this.toast.success('Chatbot deleted.');
        this.load();
      },
      error: err => this.toast.error(apiMessage(err))
    });
  }
}
