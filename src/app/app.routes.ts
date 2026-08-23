import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/login/signup.component').then(m => m.SignupComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'chat' },
      {
        path: 'chat',
        loadComponent: () => import('./pages/chat/chat.component').then(m => m.ChatComponent)
      },
      {
        path: 'admin/dashboard',
        canActivate: [roleGuard('ChatbotAdmin')],
        loadComponent: () => import('./pages/admin/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'admin/chatbots',
        canActivate: [roleGuard('ChatbotAdmin')],
        loadComponent: () => import('./pages/admin/chatbots.component').then(m => m.ChatbotsComponent)
      },
      {
        path: 'admin/knowledge',
        loadComponent: () =>
          import('./pages/admin/knowledge-bases.component').then(m => m.KnowledgeBasesComponent)
      },
      {
        path: 'admin/knowledge/:id',
        loadComponent: () => import('./pages/admin/documents.component').then(m => m.DocumentsComponent)
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard('CompanyAdmin')],
        loadComponent: () => import('./pages/admin/users.component').then(m => m.UsersComponent)
      },
      {
        path: 'admin/tenants',
        canActivate: [roleGuard('SuperAdmin')],
        loadComponent: () => import('./pages/admin/tenants.component').then(m => m.TenantsComponent)
      },
      {
        path: 'admin/audit',
        canActivate: [roleGuard('CompanyAdmin')],
        loadComponent: () => import('./pages/admin/audit.component').then(m => m.AuditComponent)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
