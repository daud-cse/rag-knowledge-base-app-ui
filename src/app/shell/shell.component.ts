import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ProviderStatus, Role } from '../core/models';

interface NavItem {
  label: string;
  icon: string;
  link: string;
  minRole?: Role;
  /** Hidden in a personal workspace, where it would have nothing to manage. */
  companyOnly?: boolean;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly status = signal<ProviderStatus | null>(null);
  readonly collapsed = signal(false);
  readonly menuOpen = signal(false);

  readonly workspace: NavItem[] = [
    { label: 'Chat', icon: '💬', link: '/chat' },
    { label: 'Knowledge', icon: '📚', link: '/admin/knowledge' }
  ];

  readonly administration: NavItem[] = [
    { label: 'Dashboard', icon: '📊', link: '/admin/dashboard', minRole: 'ChatbotAdmin' },
    { label: 'Chatbots', icon: '🤖', link: '/admin/chatbots', minRole: 'ChatbotAdmin' },
    { label: 'Users & roles', icon: '👥', link: '/admin/users', minRole: 'CompanyAdmin', companyOnly: true },
    { label: 'Audit log', icon: '🗂️', link: '/admin/audit', minRole: 'CompanyAdmin' },
    { label: 'Companies', icon: '🏢', link: '/admin/tenants', minRole: 'SuperAdmin' }
  ];

  constructor() {
    this.api.status().subscribe({
      next: value => this.status.set(value),
      error: () => undefined
    });
  }

  readonly isPersonal = computed(() => this.auth.user()?.tenantType === 'Personal');

  visible(items: NavItem[]): NavItem[] {
    return items.filter(item =>
      (!item.minRole || this.auth.hasRole(item.minRole)) &&
      (!item.companyOnly || !this.isPersonal()));
  }

  initials(name: string | undefined): string {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }
}
