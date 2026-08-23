import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  info(text: string) { this.push(text, 'info'); }
  success(text: string) { this.push(text, 'success'); }
  error(text: string) { this.push(text, 'error'); }

  dismiss(id: number) {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  private push(text: string, kind: Toast['kind']) {
    const toast: Toast = { id: this.nextId++, text, kind };
    this.toasts.update(list => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), kind === 'error' ? 6000 : 3500);
  }
}
