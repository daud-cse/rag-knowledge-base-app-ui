import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { apiMessage } from '../../core/http';
import { ToastService } from '../../core/toast.service';
import { Skill, Tool } from '../../core/models';

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>📚 Skills</h1>
          <p class="subtitle">
            Create instructions that extend what your assistants can do and make repeated tasks
            easier to reuse. The model reads a skill's description to decide whether to use it.
          </p>
        </div>
        <div class="add-wrap">
          <button class="btn primary" type="button" (click)="menuOpen.set(!menuOpen())">
            ＋ Add skill ⌄
          </button>
          @if (menuOpen()) {
            <div class="add-menu">
              <button type="button" (click)="startCreate()">Write instructions</button>
              <button type="button" (click)="startImport()">Import SKILL.md or .zip</button>
            </div>
          }
        </div>
      </div>

      <label class="field" style="max-width:460px">
        <input type="search" [ngModel]="search()" (ngModelChange)="onSearch($event)"
               name="q" placeholder="Search skills" />
      </label>

      <div class="filters">
        <button class="pill" type="button" [class.active]="!onlyInstalled()"
                (click)="onlyInstalled.set(false); load()">
          All <span class="n">{{ skills().length }}</span>
        </button>
        <button class="pill" type="button" [class.active]="onlyInstalled()"
                (click)="onlyInstalled.set(true); load()">
          Installed <span class="n">{{ installedCount() }}</span>
        </button>
      </div>

      <div class="row" style="justify-content:space-between;align-items:baseline;margin:18px 0 10px">
        <h2 style="font-size:17px">{{ onlyInstalled() ? 'Installed skills' : 'All skills' }}</h2>
        <span class="muted small">{{ visible().length }} skill{{ visible().length === 1 ? '' : 's' }}</span>
      </div>

      @if (visible().length === 0) {
        <div class="card"><div class="empty">
          <span class="icon">📚</span>
          {{ search() ? 'No skills match that search.' : 'No skills yet. Write one, or import a SKILL.md.' }}
        </div></div>
      } @else {
        <div class="grid cols-3">
          @for (skill of visible(); track skill.id) {
            <div class="card skill">
              <div class="card-body">
                <div class="row" style="align-items:flex-start;gap:10px">
                  <span class="mark">{{ monogram(skill.name) }}</span>
                  <div style="flex:1;min-width:0">
                    <h3 class="truncate">{{ skill.name }}</h3>
                    @if (!skill.isActive) { <span class="badge bad">disabled</span> }
                  </div>
                </div>

                <p class="muted small clamp">{{ skill.description }}</p>

                @if (tagList(skill).length > 0) {
                  <div class="chips">
                    @for (tag of tagList(skill); track tag) { <span class="badge">{{ tag }}</span> }
                  </div>
                }

                <p class="muted small" style="margin:10px 0 0">
                  v{{ skill.version }}
                  @if (skill.tools.length > 0) { · {{ skill.tools.length }} tool{{ skill.tools.length === 1 ? '' : 's' }} }
                </p>
              </div>

              <div class="card-foot">
                <span class="muted small">Updated {{ skill.updatedAt | date: 'd MMM yyyy' }}</span>
                <span style="flex:1"></span>
                <button class="btn ghost sm" type="button" (click)="edit(skill)">Edit</button>
                @if (skill.isInstalled) {
                  <button class="btn sm" type="button" (click)="setInstalled(skill, false)">Uninstall</button>
                } @else {
                  <button class="btn primary sm" type="button" (click)="setInstalled(skill, true)">Install</button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- --------------------------- write / edit --------------------------- -->
    @if (editing(); as current) {
      <div class="modal-backdrop" (click)="editing.set(null)">
        <div class="modal wide" (click)="$event.stopPropagation()">
          <header>
            <div>
              <h2>Write skill instructions</h2>
              <p class="muted small" style="margin:2px 0 0">
                Create a reusable skill with a clear description and markdown instructions.
              </p>
            </div>
            <button class="btn ghost sm" type="button" (click)="editing.set(null)">✕</button>
          </header>

          <div class="body">
            <label class="field">
              <span class="label">Skill name <em class="count">{{ form.name.length }}/64</em></span>
              <input type="text" [(ngModel)]="form.name" name="name" maxlength="64"
                     placeholder="weekly-status-report" />
            </label>

            <label class="field">
              <span class="label">Description <em class="count">{{ form.description.length }}/1024</em></span>
              <textarea [(ngModel)]="form.description" name="description" rows="3" maxlength="1024"
                        placeholder="Generate weekly status reports from recent work and summarize progress clearly."></textarea>
              <span class="hint">
                The model decides whether to use this skill based on the description, so make it specific.
              </span>
            </label>

            <label class="field">
              <span class="label">Tags</span>
              <input type="text" [(ngModel)]="form.tags" name="tags" placeholder="example, support, onboarding" />
              <span class="hint">Separate multiple tags with commas.</span>
            </label>

            <div class="field">
              <span class="label">
                Tools <em class="count">{{ form.toolIds.length }} selected</em>
              </span>
              <span class="hint" style="margin:0 0 7px">
                Choose one or more API tools or MCP servers to include in this skill. They become
                callable only once the model has adopted it.
              </span>
              @if (tools().length === 0) {
                <div class="empty sm">No tools available.</div>
              } @else {
                <div class="tool-picker">
                  @for (tool of tools(); track tool.id) {
                    <label class="pick">
                      <input type="checkbox" [checked]="form.toolIds.includes(tool.id)"
                             (change)="toggleTool(tool.id)" />
                      <span>
                        <strong>{{ tool.name }}</strong>
                        <span class="muted small">{{ tool.type }} · {{ tool.operations.length }} operations</span>
                      </span>
                    </label>
                  }
                </div>
              }
            </div>

            <label class="field">
              <span class="label">
                Instructions <em class="count">{{ form.instructions.length }}/50000</em>
              </span>
              <textarea [(ngModel)]="form.instructions" name="instructions" rows="12" maxlength="50000"
                        class="mono" placeholder="## When to use&#10;...&#10;&#10;## How to answer&#10;1. ..."></textarea>
              <span class="hint">Saved as markdown, and exported as the SKILL.md file.</span>
            </label>

            <label class="check">
              <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />
              <span class="check-text">
                <strong>Active</strong>
                <span>An inactive skill is never offered to the model.</span>
              </span>
            </label>
          </div>

          <footer>
            @if (current.id) {
              <button class="btn ghost" type="button" (click)="remove(current)">Delete skill</button>
              <a class="btn ghost" [href]="exportUrl(current)" download>Export</a>
            }
            <span style="flex:1"></span>
            <button class="btn" type="button" (click)="editing.set(null)">Cancel</button>
            <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
              {{ current.id ? 'Save changes' : '＋ Create' }}
            </button>
          </footer>
        </div>
      </div>
    }

    <!-- ------------------------------ import ------------------------------ -->
    @if (importing()) {
      <div class="modal-backdrop" (click)="importing.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <header>
            <h2>Import skill</h2>
            <button class="btn ghost sm" type="button" (click)="importing.set(false)">✕</button>
          </header>

          <div class="body">
            <p class="muted small">
              Upload a <code>SKILL.md</code> file directly, or import a <code>.zip</code> skill
              archive. The SKILL.md must include YAML frontmatter with a name and description.
            </p>

            <label class="drop" [class.over]="dragOver()"
                   (dragover)="$event.preventDefault(); dragOver.set(true)"
                   (dragleave)="dragOver.set(false)"
                   (drop)="onDrop($event)">
              <input type="file" accept=".md,.markdown,.txt,.zip" hidden
                     (change)="onPick($event)" />
              <span class="drop-icon">⭱</span>
              <strong>Drag and drop a SKILL.md or .zip file, or click to select</strong>
              <span class="muted small">
                Single <code>SKILL.md</code> file, or a <code>.zip</code> skill archive.
                Unsupported file types are ignored.
              </span>
              @if (chosen(); as f) { <span class="badge brand">{{ f.name }}</span> }
            </label>
          </div>

          <footer>
            <button class="btn" type="button" (click)="importing.set(false)">Cancel</button>
            <button class="btn primary" type="button" [disabled]="!chosen() || busy()"
                    (click)="runImport()">Import</button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [`
    .add-wrap { position: relative; }
    .add-menu {
      position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; min-width: 230px;
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      box-shadow: var(--shadow-lg); overflow: hidden;
    }
    .add-menu button {
      display: block; width: 100%; text-align: left; font: inherit; font-size: 13.5px;
      padding: 10px 14px; border: none; background: none; color: var(--text); cursor: pointer;
    }
    .add-menu button:hover { background: var(--surface-2); }

    .filters { display: flex; gap: 8px; margin: 12px 0 0; }
    .pill {
      font: inherit; font-size: 13px; padding: 6px 15px; border-radius: 999px; cursor: pointer;
      border: 1px solid var(--border-strong); background: var(--surface); color: var(--text);
    }
    .pill.active { background: var(--brand); border-color: var(--brand); color: #fff; }
    .pill .n { opacity: .7; margin-left: 4px; font-variant-numeric: tabular-nums; }

    .mark {
      flex: none; width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center;
      background: var(--brand-soft); color: var(--brand); font-weight: 700; font-size: 12.5px;
    }
    .clamp {
      margin: 10px 0 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
    .card-foot {
      display: flex; align-items: center; gap: 7px; padding: 10px 14px;
      border-top: 1px solid var(--border);
    }

    .count { font-style: normal; float: right; color: var(--text-muted); font-size: 11.5px; }
    textarea.mono { font-family: var(--mono); font-size: 12.5px; }

    .tool-picker {
      border: 1px solid var(--border); border-radius: var(--radius-sm); max-height: 190px;
      overflow-y: auto; background: var(--surface);
    }
    .pick {
      display: flex; align-items: center; gap: 10px; padding: 8px 12px; cursor: pointer;
      border-bottom: 1px solid var(--border); margin: 0;
    }
    .pick:last-child { border-bottom: none; }
    .pick:hover { background: var(--surface-2); }
    .pick span { display: flex; flex-direction: column; }

    .drop {
      display: flex; flex-direction: column; align-items: center; gap: 7px; text-align: center;
      padding: 34px 22px; cursor: pointer; border-radius: var(--radius);
      border: 2px dashed var(--border-strong); background: var(--surface-2);
    }
    .drop.over { border-color: var(--brand); background: var(--brand-soft); }
    .drop-icon { font-size: 26px; color: var(--text-muted); }
    .empty.sm { padding: 14px; font-size: 13px; }
  `]
})
export class SkillsComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly skills = signal<Skill[]>([]);
  readonly tools = signal<Tool[]>([]);
  readonly search = signal('');
  readonly onlyInstalled = signal(false);
  readonly menuOpen = signal(false);
  readonly editing = signal<Partial<Skill> | null>(null);
  readonly importing = signal(false);
  readonly dragOver = signal(false);
  readonly chosen = signal<File | null>(null);
  readonly busy = signal(false);

  readonly visible = computed(() =>
    this.onlyInstalled() ? this.skills().filter(s => s.isInstalled) : this.skills());
  readonly installedCount = computed(() => this.skills().filter(s => s.isInstalled).length);

  form = this.blank();
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
  }

  tagList(skill: Skill): string[] {
    return (skill.tags ?? '').split(',').map(t => t.trim()).filter(Boolean);
  }

  monogram(name: string): string {
    const words = name.split(/[-_\s]+/).filter(Boolean);
    return words.length > 1
      ? (words[0][0] + words[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }

  exportUrl(skill: Partial<Skill>): string { return `/api/skills/${skill.id}/export`; }

  onSearch(value: string): void {
    this.search.set(value);
    // Debounced: the filter runs server-side so it can match instructions and tags too.
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 250);
  }

  load(): void {
    this.api.skills(false, this.search() || undefined).subscribe({
      next: s => this.skills.set(s),
      error: e => this.toast.error(apiMessage(e, 'Could not load skills.'))
    });
  }

  startCreate(): void {
    this.menuOpen.set(false);
    this.form = this.blank();
    this.loadTools();
    this.editing.set({});
  }

  startImport(): void {
    this.menuOpen.set(false);
    this.chosen.set(null);
    this.importing.set(true);
  }

  edit(skill: Skill): void {
    this.form = {
      name: skill.name,
      description: skill.description,
      tags: skill.tags ?? '',
      instructions: skill.instructions,
      version: skill.version,
      isActive: skill.isActive,
      isInstalled: skill.isInstalled,
      toolIds: skill.tools.map(t => t.toolId)
    };
    this.loadTools();
    this.editing.set(skill);
  }

  toggleTool(id: string): void {
    this.form.toolIds = this.form.toolIds.includes(id)
      ? this.form.toolIds.filter(t => t !== id)
      : [...this.form.toolIds, id];
  }

  save(): void {
    if (!this.form.name.trim()) { this.toast.error('A skill needs a name.'); return; }
    if (!this.form.description.trim()) {
      this.toast.error('A description is required — the model reads it to decide when to use the skill.');
      return;
    }

    const current = this.editing();
    this.busy.set(true);
    const request = current?.id
      ? this.api.updateSkill(current.id, this.form)
      : this.api.createSkill(this.form);

    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.editing.set(null);
        this.toast.success('Skill saved.');
        this.load();
      },
      error: e => {
        this.busy.set(false);
        this.toast.error(apiMessage(e, 'Could not save the skill.'));
      }
    });
  }

  setInstalled(skill: Skill, installed: boolean): void {
    if (!installed && !confirm(`Uninstall ${skill.name}? It will be removed from every assistant using it.`))
      return;
    this.api.setSkillInstalled(skill.id, installed).subscribe({
      next: () => { this.toast.success(installed ? 'Installed.' : 'Uninstalled.'); this.load(); },
      error: e => this.toast.error(apiMessage(e, 'Could not change that.'))
    });
  }

  remove(skill: Partial<Skill>): void {
    if (!skill.id || !confirm(`Delete ${skill.name}? This cannot be undone.`)) return;
    this.api.deleteSkill(skill.id).subscribe({
      next: () => { this.editing.set(null); this.toast.success('Skill deleted.'); this.load(); },
      error: e => this.toast.error(apiMessage(e, 'Could not delete the skill.'))
    });
  }

  onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.chosen.set(input.files[0]);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.chosen.set(file);
  }

  runImport(): void {
    const file = this.chosen();
    if (!file) return;
    this.busy.set(true);
    this.api.importSkill(file).subscribe({
      next: r => {
        this.busy.set(false);
        this.importing.set(false);
        this.toast.success(`Imported ${r.imported} skill${r.imported === 1 ? '' : 's'}.`);
        // Warnings carry the reason a file was skipped, which is the useful half of an import.
        r.warnings.forEach(w => this.toast.error(w));
        this.load();
      },
      error: e => {
        this.busy.set(false);
        this.toast.error(apiMessage(e, 'Could not import that file.'));
      }
    });
  }

  private loadTools(): void {
    this.api.tools().subscribe({ next: t => this.tools.set(t), error: () => this.tools.set([]) });
  }

  private blank() {
    return {
      name: '', description: '', tags: '', instructions: '', version: '1.0.0',
      isActive: true, isInstalled: true, toolIds: [] as string[]
    };
  }
}
