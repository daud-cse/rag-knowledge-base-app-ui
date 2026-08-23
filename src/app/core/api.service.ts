import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AnalyticsSummary, AppUser, AuditEntry, Chatbot, ChatMessage, ChatResponse, Chunk, Conversation,
  DocumentItem, KnowledgeBase, KnowledgeBaseLink, LoginResponse, Paged, ProviderStatus, Role, Tenant
} from './models';

/** One place that knows the shape of the API, so components stay declarative. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // ---------- system ----------
  status(): Observable<ProviderStatus> {
    return this.http.get<ProviderStatus>('/api/system/status');
  }

  // ---------- tenants ----------
  tenants(): Observable<Tenant[]> {
    return this.http.get<Tenant[]>('/api/tenants');
  }
  createTenant(body: {
    name: string; slug: string; description?: string | null; allowedEmailDomains?: string | null;
    adminEmail?: string | null; adminPassword?: string | null; adminDisplayName?: string | null;
  }): Observable<Tenant> {
    return this.http.post<Tenant>('/api/tenants', body);
  }
  registerWorkspace(body: {
    accountType: 'Personal' | 'Company'; email: string; password: string; displayName?: string;
    companyName?: string | null; slug?: string | null; allowedEmailDomains?: string | null;
  }) {
    return this.http.post<LoginResponse>('/api/auth/register', body);
  }
  updateTenant(id: string, body: {
    name: string; slug: string; description?: string | null; allowedEmailDomains?: string | null;
  }): Observable<void> {
    return this.http.put<void>(`/api/tenants/${id}`, body);
  }
  toggleTenant(id: string): Observable<{ isActive: boolean }> {
    return this.http.post<{ isActive: boolean }>(`/api/tenants/${id}/toggle`, {});
  }
  deleteTenant(id: string): Observable<void> {
    return this.http.delete<void>(`/api/tenants/${id}`);
  }

  // ---------- users ----------
  users(tenantId?: string): Observable<AppUser[]> {
    let params = new HttpParams();
    if (tenantId) params = params.set('tenantId', tenantId);
    return this.http.get<AppUser[]>('/api/users', { params });
  }
  createUser(body: {
    email: string; displayName: string; password: string; role: Role;
    department?: string | null; maxClassification?: string | null; tenantId?: string | null;
  }): Observable<AppUser> {
    return this.http.post<AppUser>('/api/users', body);
  }
  updateUser(id: string, body: Partial<{
    displayName: string; role: Role; department: string | null;
    maxClassification: string; isActive: boolean; password: string;
  }>): Observable<AppUser> {
    return this.http.put<AppUser>(`/api/users/${id}`, body);
  }
  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`/api/users/${id}`);
  }

  // ---------- knowledge bases ----------
  knowledgeBases(scope?: string): Observable<KnowledgeBase[]> {
    let params = new HttpParams();
    if (scope) params = params.set('scope', scope);
    return this.http.get<KnowledgeBase[]>('/api/knowledge-bases', { params });
  }
  knowledgeBase(id: string): Observable<KnowledgeBase> {
    return this.http.get<KnowledgeBase>(`/api/knowledge-bases/${id}`);
  }
  createKnowledgeBase(body: {
    name: string; description?: string | null; scope?: string;
    chunkSize?: number; chunkOverlap?: number; embeddingModel?: string;
  }): Observable<KnowledgeBase> {
    return this.http.post<KnowledgeBase>('/api/knowledge-bases', body);
  }
  updateKnowledgeBase(id: string, body: Partial<{
    name: string; description: string | null; chunkSize: number;
    chunkOverlap: number; embeddingModel: string; isActive: boolean;
  }>): Observable<KnowledgeBase> {
    return this.http.put<KnowledgeBase>(`/api/knowledge-bases/${id}`, body);
  }
  deleteKnowledgeBase(id: string): Observable<void> {
    return this.http.delete<void>(`/api/knowledge-bases/${id}`);
  }

  // ---------- documents ----------
  documents(knowledgeBaseId?: string, status?: string): Observable<DocumentItem[]> {
    let params = new HttpParams();
    if (knowledgeBaseId) params = params.set('knowledgeBaseId', knowledgeBaseId);
    if (status) params = params.set('status', status);
    return this.http.get<DocumentItem[]>('/api/documents', { params });
  }
  uploadDocuments(knowledgeBaseId: string, classification: string, files: File[]): Observable<DocumentItem[]> {
    const form = new FormData();
    form.append('knowledgeBaseId', knowledgeBaseId);
    form.append('classification', classification);
    files.forEach(file => form.append('files', file, file.name));
    return this.http.post<DocumentItem[]>('/api/documents/upload', form);
  }
  documentChunks(id: string): Observable<Chunk[]> {
    return this.http.get<Chunk[]>(`/api/documents/${id}/chunks`);
  }
  reprocessDocument(id: string): Observable<unknown> {
    return this.http.post(`/api/documents/${id}/reprocess`, {});
  }
  deleteDocument(id: string): Observable<void> {
    return this.http.delete<void>(`/api/documents/${id}`);
  }
  downloadDocument(id: string): Observable<Blob> {
    return this.http.get(`/api/documents/${id}/download`, { responseType: 'blob' });
  }

  // ---------- chatbots ----------
  chatbots(onlyActive = false): Observable<Chatbot[]> {
    let params = new HttpParams();
    if (onlyActive) params = params.set('onlyActive', 'true');
    return this.http.get<Chatbot[]>('/api/chatbots', { params });
  }
  chatbot(id: string): Observable<Chatbot> {
    return this.http.get<Chatbot>(`/api/chatbots/${id}`);
  }
  createChatbot(body: Partial<Chatbot>): Observable<Chatbot> {
    return this.http.post<Chatbot>('/api/chatbots', body);
  }
  updateChatbot(id: string, body: Partial<Chatbot>): Observable<Chatbot> {
    return this.http.put<Chatbot>(`/api/chatbots/${id}`, body);
  }
  mapKnowledgeBases(id: string, knowledgeBases: KnowledgeBaseLink[]): Observable<Chatbot> {
    return this.http.put<Chatbot>(`/api/chatbots/${id}/knowledge-bases`, { knowledgeBases });
  }
  deleteChatbot(id: string): Observable<void> {
    return this.http.delete<void>(`/api/chatbots/${id}`);
  }

  // ---------- chat ----------
  conversations(search?: string): Observable<Conversation[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<Conversation[]>('/api/chat/conversations', { params });
  }
  startConversation(chatbotId: string, title?: string): Observable<Conversation> {
    return this.http.post<Conversation>('/api/chat/conversations', { chatbotId, title: title ?? null });
  }
  messages(conversationId: string): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`/api/chat/conversations/${conversationId}/messages`);
  }
  send(conversationId: string, message: string, attachmentDocumentIds: string[] = []): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`/api/chat/conversations/${conversationId}/messages`,
      { message, attachmentDocumentIds });
  }
  regenerate(conversationId: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`/api/chat/conversations/${conversationId}/regenerate`, {});
  }
  renameConversation(conversationId: string, title: string): Observable<void> {
    return this.http.put<void>(`/api/chat/conversations/${conversationId}`, { title });
  }
  deleteConversation(conversationId: string): Observable<void> {
    return this.http.delete<void>(`/api/chat/conversations/${conversationId}`);
  }
  exportConversation(conversationId: string): Observable<Blob> {
    return this.http.get(`/api/chat/conversations/${conversationId}/export`, { responseType: 'blob' });
  }
  feedback(messageId: string, feedback: 'ThumbsUp' | 'ThumbsDown' | 'None', comment?: string): Observable<void> {
    return this.http.post<void>(`/api/chat/messages/${messageId}/feedback`,
      { feedback, comment: comment ?? null });
  }
  attach(conversationId: string, files: File[]): Observable<DocumentItem[]> {
    const form = new FormData();
    files.forEach(file => form.append('files', file, file.name));
    return this.http.post<DocumentItem[]>(`/api/chat/conversations/${conversationId}/attachments`, form);
  }
  attachments(conversationId: string): Observable<DocumentItem[]> {
    return this.http.get<DocumentItem[]>(`/api/chat/conversations/${conversationId}/attachments`);
  }

  // ---------- analytics ----------
  analytics(days = 14): Observable<AnalyticsSummary> {
    return this.http.get<AnalyticsSummary>('/api/analytics/summary', {
      params: new HttpParams().set('days', days)
    });
  }
  audit(page = 1, pageSize = 50, action?: string): Observable<Paged<AuditEntry>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (action) params = params.set('action', action);
    return this.http.get<Paged<AuditEntry>>('/api/analytics/audit', { params });
  }
}
