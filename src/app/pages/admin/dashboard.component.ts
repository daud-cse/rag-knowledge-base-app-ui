import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { apiMessage } from '../../core/http';
import { ToastService } from '../../core/toast.service';
import { AnalyticsSummary } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DecimalPipe, FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Dashboard</h1>
          <p class="subtitle">
            Usage, quality and cost across every chatbot and knowledge base in this company.
          </p>
        </div>
        <select style="width:auto" [ngModel]="days()" (ngModelChange)="reload($event)" name="days">
          <option [ngValue]="7">Last 7 days</option>
          <option [ngValue]="14">Last 14 days</option>
          <option [ngValue]="30">Last 30 days</option>
        </select>
      </div>

      @if (data(); as d) {
        <div class="grid cols-4" style="margin-bottom:16px">
          <div class="card stat">
            <span class="label">Questions asked</span>
            <strong>{{ d.questions | number }}</strong>
            <span class="muted small">{{ d.conversations | number }} conversations</span>
          </div>
          <div class="card stat">
            <span class="label">Answered from sources</span>
            <strong>{{ d.successRatePct }}%</strong>
            <span class="muted small">{{ d.noAnswerRatePct }}% no-answer</span>
          </div>
          <div class="card stat">
            <span class="label">Avg response time</span>
            <strong>{{ d.avgResponseTimeSec }}s</strong>
            <span class="muted small">retrieval + generation</span>
          </div>
          <div class="card stat">
            <span class="label">Estimated LLM cost</span>
            <strong>\${{ d.estimatedCostUsd | number: '1.2-4' }}</strong>
            <span class="muted small">
              {{ (d.promptTokens + d.completionTokens) | number }} tokens
            </span>
          </div>
        </div>

        <div class="grid cols-4" style="margin-bottom:16px">
          <div class="card stat sm">
            <span class="label">Users</span><strong>{{ d.users | number }}</strong>
          </div>
          <div class="card stat sm">
            <span class="label">Chatbots</span><strong>{{ d.chatbots | number }}</strong>
          </div>
          <div class="card stat sm">
            <span class="label">Knowledge bases</span><strong>{{ d.knowledgeBases | number }}</strong>
          </div>
          <div class="card stat sm">
            <span class="label">Indexed chunks</span>
            <strong>{{ d.chunks | number }}</strong>
            <span class="muted small">{{ d.documents | number }} documents</span>
          </div>
        </div>

        @if (d.failedDocuments > 0) {
          <div class="notice">
            <span>⚠️</span>
            <span>
              {{ d.failedDocuments }} document(s) failed to process.
              <a routerLink="/admin/knowledge">Review them in Knowledge bases</a> and retry.
            </span>
          </div>
        }

        <div class="grid cols-2">
          <div class="card">
            <div class="card-head"><h2>Questions per day</h2></div>
            <div class="card-body">
              @if (maxPerDay() > 0) {
                <div class="chart">
                  @for (point of d.questionsPerDay; track point.label) {
                    <div class="col" [title]="point.label + ': ' + point.value">
                      <div class="bar" [style.height.%]="barHeight(point.value)"></div>
                      <span class="tick">{{ point.label }}</span>
                    </div>
                  }
                </div>
              } @else {
                <div class="empty"><span class="icon">📈</span>No questions in this window yet.</div>
              }
            </div>
          </div>

          <div class="card">
            <div class="card-head"><h2>Answer feedback</h2></div>
            <div class="card-body">
              <div class="feedback">
                <div>
                  <span class="big good">👍 {{ d.thumbsUp }}</span>
                  <span class="muted small">helpful</span>
                </div>
                <div>
                  <span class="big bad">👎 {{ d.thumbsDown }}</span>
                  <span class="muted small">not helpful</span>
                </div>
                <div>
                  <span class="big">{{ d.questions - d.thumbsUp - d.thumbsDown }}</span>
                  <span class="muted small">unrated</span>
                </div>
              </div>

              <h3 style="margin:18px 0 8px">Most used chatbots</h3>
              @for (item of d.topChatbots; track item.name) {
                <div class="meter">
                  <span class="truncate">{{ item.name }}</span>
                  <div class="track"><div class="fill" [style.width.%]="share(item.count, d.topChatbots)"></div></div>
                  <span class="mono">{{ item.count }}</span>
                </div>
              } @empty {
                <p class="muted small">No conversations yet.</p>
              }

              <h3 style="margin:18px 0 8px">Largest knowledge bases (chunks)</h3>
              @for (item of d.topKnowledgeBases; track item.name) {
                <div class="meter">
                  <span class="truncate">{{ item.name }}</span>
                  <div class="track"><div class="fill alt" [style.width.%]="share(item.count, d.topKnowledgeBases)"></div></div>
                  <span class="mono">{{ item.count }}</span>
                </div>
              } @empty {
                <p class="muted small">No indexed documents yet.</p>
              }
            </div>
          </div>
        </div>
      } @else {
        <div class="card"><div class="empty"><span class="spinner"></span></div></div>
      }
    </div>
  `,
  styles: [`
    .stat {
      padding: 15px 17px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .stat strong { font-size: 26px; font-weight: 650; letter-spacing: -0.02em; }
    .stat.sm strong { font-size: 20px; }

    .chart {
      display: flex;
      align-items: flex-end;
      gap: 5px;
      height: 190px;
      padding-top: 8px;
    }
    .chart .col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
    .chart .bar {
      width: 100%;
      max-width: 34px;
      background: linear-gradient(180deg, #4c6ef5, #3b5bdb);
      border-radius: 4px 4px 0 0;
      margin-top: auto;
      min-height: 3px;
      transition: height .25s ease;
    }
    .chart .tick {
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 6px;
      white-space: nowrap;
      transform: rotate(-38deg);
      transform-origin: top center;
      height: 26px;
    }

    .feedback { display: flex; gap: 26px; }
    .feedback > div { display: flex; flex-direction: column; }
    .feedback .big { font-size: 21px; font-weight: 650; }
    .feedback .good { color: var(--accent); }
    .feedback .bad { color: var(--danger); }

    .meter {
      display: grid;
      grid-template-columns: 150px 1fr 44px;
      align-items: center;
      gap: 10px;
      font-size: 12.5px;
      margin-bottom: 7px;
    }
    .meter .track { height: 7px; background: var(--surface-2); border-radius: 4px; overflow: hidden; border: 1px solid var(--border); }
    .meter .fill { height: 100%; background: var(--brand); border-radius: 4px; }
    .meter .fill.alt { background: var(--accent); }
    .meter .mono { text-align: right; color: var(--text-muted); }
  `]
})
export class DashboardComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly data = signal<AnalyticsSummary | null>(null);
  readonly days = signal(14);

  readonly maxPerDay = computed(() =>
    Math.max(0, ...(this.data()?.questionsPerDay ?? []).map(p => p.value)));

  constructor() {
    this.reload(14);
  }

  reload(days: number): void {
    this.days.set(days);
    this.data.set(null);
    this.api.analytics(days).subscribe({
      next: value => this.data.set(value),
      error: err => this.toast.error(apiMessage(err, 'Could not load analytics.'))
    });
  }

  barHeight(value: number): number {
    const max = this.maxPerDay();
    return max === 0 ? 0 : Math.max(2, (value / max) * 100);
  }

  share(count: number, items: { count: number }[]): number {
    const max = Math.max(1, ...items.map(i => i.count));
    return Math.max(3, (count / max) * 100);
  }
}
