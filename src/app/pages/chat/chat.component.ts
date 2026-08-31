import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ApiService } from '../../core/api.service';
import { apiMessage } from '../../core/http';
import { ToastService } from '../../core/toast.service';
import { Chatbot, ChatMessage, Citation, Conversation, DocumentItem } from '../../core/models';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('scroller') scroller?: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  readonly chatbots = signal<Chatbot[]>([]);
  readonly conversations = signal<Conversation[]>([]);
  readonly messages = signal<ChatMessage[]>([]);
  readonly attachments = signal<DocumentItem[]>([]);
  readonly followUps = signal<string[]>([]);

  readonly activeBotId = signal<string | null>(null);
  readonly activeConversationId = signal<string | null>(null);
  readonly sending = signal(false);
  readonly loading = signal(true);
  readonly search = signal('');
  /** Below 900px the conversation rail becomes a slide-over drawer; this is its open state. */
  readonly railOpen = signal(false);
  readonly openCitations = signal<Set<string>>(new Set());

  draft = '';

  readonly activeBot = computed(() =>
    this.chatbots().find(bot => bot.id === this.activeBotId()) ?? null);

  readonly activeConversation = computed(() =>
    this.conversations().find(c => c.id === this.activeConversationId()) ?? null);

  constructor() {
    this.api.chatbots(true).subscribe({
      next: bots => {
        this.chatbots.set(bots);
        if (bots.length) this.activeBotId.set(bots[0].id);
        this.loading.set(false);
      },
      error: err => {
        this.toast.error(apiMessage(err, 'Could not load chatbots.'));
        this.loading.set(false);
      }
    });
    this.loadConversations();
  }

  // ------------------------------ conversations ------------------------------

  loadConversations(): void {
    this.api.conversations(this.search() || undefined).subscribe({
      next: list => this.conversations.set(list),
      error: () => undefined
    });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.loadConversations();
  }

  newConversation(): void {
    const botId = this.activeBotId();
    if (!botId) {
      this.toast.error('No chatbot is available yet.');
      return;
    }
    this.activeConversationId.set(null);
    this.messages.set([]);
    this.attachments.set([]);
    this.followUps.set([]);
  }

  open(conversation: Conversation): void {
    this.activeConversationId.set(conversation.id);
    this.activeBotId.set(conversation.chatbotId);
    this.followUps.set([]);
    this.api.messages(conversation.id).subscribe({
      next: list => {
        this.messages.set(list);
        this.scrollToEnd();
      },
      error: err => this.toast.error(apiMessage(err, 'Could not load the conversation.'))
    });
    this.api.attachments(conversation.id).subscribe({
      next: docs => this.attachments.set(docs),
      error: () => this.attachments.set([])
    });
  }

  rename(conversation: Conversation): void {
    const title = prompt('Rename conversation', conversation.title);
    if (!title?.trim()) return;
    this.api.renameConversation(conversation.id, title.trim()).subscribe({
      next: () => {
        this.conversations.update(list =>
          list.map(c => (c.id === conversation.id ? { ...c, title: title.trim() } : c)));
      },
      error: err => this.toast.error(apiMessage(err))
    });
  }

  remove(conversation: Conversation): void {
    if (!confirm(`Delete "${conversation.title}"? Any files attached to it are deleted too.`)) return;
    this.api.deleteConversation(conversation.id).subscribe({
      next: () => {
        this.conversations.update(list => list.filter(c => c.id !== conversation.id));
        if (this.activeConversationId() === conversation.id) this.newConversation();
        this.toast.success('Conversation deleted.');
      },
      error: err => this.toast.error(apiMessage(err))
    });
  }

  exportConversation(): void {
    const id = this.activeConversationId();
    if (!id) return;
    this.api.exportConversation(id).subscribe({
      next: blob => this.saveBlob(blob, `conversation-${id}.md`),
      error: err => this.toast.error(apiMessage(err))
    });
  }

  // -------------------------------- messaging --------------------------------

  ask(question: string): void {
    this.draft = question;
    this.send();
  }

  send(): void {
    const text = this.draft.trim();
    const botId = this.activeBotId();
    if (!text || this.sending() || !botId) return;

    this.draft = '';
    this.followUps.set([]);
    this.sending.set(true);

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`, role: 'User', content: text, citations: [], model: null,
      promptTokens: 0, completionTokens: 0, latencyMs: 0, noAnswer: false, feedback: 'None',
      createdAt: new Date().toISOString()
    };
    const placeholder: ChatMessage = { ...optimistic, id: 'pending', role: 'Assistant', content: '', pending: true };
    this.messages.update(list => [...list, optimistic, placeholder]);
    this.scrollToEnd();

    const conversationId = this.activeConversationId();
    if (conversationId) {
      this.dispatch(conversationId, text);
      return;
    }

    // First message in a new chat: create the conversation, then send.
    this.api.startConversation(botId).subscribe({
      next: conversation => {
        this.activeConversationId.set(conversation.id);
        this.conversations.update(list => [conversation, ...list]);
        this.dispatch(conversation.id, text);
      },
      error: err => {
        this.failPlaceholder(apiMessage(err, 'Could not start the conversation.'));
      }
    });
  }

  private dispatch(conversationId: string, text: string): void {
    const attachmentIds = this.attachments().filter(a => a.status === 'Indexed').map(a => a.id);
    this.api.send(conversationId, text, attachmentIds).subscribe({
      next: response => {
        this.messages.update(list => [...list.filter(m => m.id !== 'pending'), response.message]);
        this.followUps.set(response.followUpQuestions ?? []);
        this.sending.set(false);
        this.scrollToEnd();
        this.loadConversations();
      },
      error: err => this.failPlaceholder(apiMessage(err, 'The assistant could not answer.'))
    });
  }

  private failPlaceholder(message: string): void {
    this.messages.update(list => list.filter(m => m.id !== 'pending'));
    this.sending.set(false);
    this.toast.error(message);
  }

  regenerate(): void {
    const id = this.activeConversationId();
    if (!id || this.sending()) return;
    this.sending.set(true);
    this.api.regenerate(id).subscribe({
      next: response => {
        this.api.messages(id).subscribe(list => {
          this.messages.set(list);
          this.scrollToEnd();
        });
        this.followUps.set(response.followUpQuestions ?? []);
        this.sending.set(false);
      },
      error: err => {
        this.sending.set(false);
        this.toast.error(apiMessage(err));
      }
    });
  }

  rate(message: ChatMessage, feedback: 'ThumbsUp' | 'ThumbsDown'): void {
    const next = message.feedback === feedback ? 'None' : feedback;
    this.api.feedback(message.id, next).subscribe({
      next: () => {
        this.messages.update(list =>
          list.map(m => (m.id === message.id ? { ...m, feedback: next } : m)));
      },
      error: err => this.toast.error(apiMessage(err))
    });
  }

  copy(message: ChatMessage): void {
    navigator.clipboard.writeText(message.content).then(
      () => this.toast.success('Answer copied.'),
      () => this.toast.error('Clipboard is not available.')
    );
  }

  // ------------------------------- attachments -------------------------------

  pickFiles(): void {
    if (!this.activeConversationId()) {
      this.toast.info('Send a message first, then attach files to this conversation.');
      return;
    }
    this.fileInput?.nativeElement.click();
  }

  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const conversationId = this.activeConversationId();
    if (!files.length || !conversationId) return;

    this.api.attach(conversationId, files).subscribe({
      next: docs => {
        this.attachments.update(list => [...list, ...docs]);
        this.toast.success(`${docs.length} file(s) attached. Indexing…`);
        this.pollAttachments(conversationId);
      },
      error: err => this.toast.error(apiMessage(err, 'Upload failed.'))
    });
    input.value = '';
  }

  /** Ingestion is asynchronous, so poll until nothing is mid-pipeline. */
  private pollAttachments(conversationId: string, attempt = 0): void {
    if (attempt > 20) return;
    setTimeout(() => {
      this.api.attachments(conversationId).subscribe({
        next: docs => {
          this.attachments.set(docs);
          if (docs.some(d => d.status !== 'Indexed' && d.status !== 'Failed')) {
            this.pollAttachments(conversationId, attempt + 1);
          }
        },
        error: () => undefined
      });
    }, 1200);
  }

  // --------------------------------- helpers ---------------------------------

  toggleCitations(messageId: string): void {
    this.openCitations.update(set => {
      const next = new Set(set);
      next.has(messageId) ? next.delete(messageId) : next.add(messageId);
      return next;
    });
  }

  citationsOpen(messageId: string): boolean {
    return this.openCitations().has(messageId);
  }

  /** Minimal, escape-first renderer: headings, bold, bullets, code and citation chips. */
  render(message: ChatMessage): SafeHtml {
    const escaped = message.content
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const html = escaped
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>')
      .replace(/\[(\d{1,2})\]/g, '<span class="cite">$1</span>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');

    return this.sanitizer.bypassSecurityTrustHtml(`<p>${html}</p>`);
  }

  citationLabel(citation: Citation): string {
    return citation.locator ? `${citation.fileName} · ${citation.locator}` : citation.fileName;
  }

  statusTone(status: string): string {
    if (status === 'Indexed') return 'good';
    if (status === 'Failed') return 'bad';
    return 'warn';
  }

  private saveBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  private scrollToEnd(): void {
    setTimeout(() => {
      const element = this.scroller?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    }, 30);
  }
}
