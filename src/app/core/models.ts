export type Role = 'User' | 'ChatbotAdmin' | 'KnowledgeAdmin' | 'CompanyAdmin' | 'SuperAdmin';
export type ClassificationLevel = 'Public' | 'Internal' | 'Confidential' | 'Restricted';

export const ROLE_RANK: Record<Role, number> = {
  User: 10,
  ChatbotAdmin: 20,
  KnowledgeAdmin: 30,
  CompanyAdmin: 40,
  SuperAdmin: 50
};

export const CLASSIFICATIONS: ClassificationLevel[] = ['Public', 'Internal', 'Confidential', 'Restricted'];

export interface Me {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  tenantName: string;
  tenantId: string;
  maxClassification: ClassificationLevel;
  department: string | null;
  identityProvider: string;
  tenantType: TenantType;
}

export type TenantType = 'Company' | 'Personal';

export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  user: Me;
}

export interface AuthProviders {
  local: boolean;
  individualSignup: boolean;
  companySignup: boolean;
  google: boolean;
  googleClientId: string | null;
  entraId: boolean;
  entraClientId: string | null;
  entraAuthority: string | null;
  saml: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  allowedEmailDomains: string | null;
  type: TenantType;
  isActive: boolean;
  createdAt: string;
  userCount: number;
  chatbotCount: number;
  knowledgeBaseCount: number;
}

export interface AppUser {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  department: string | null;
  role: Role;
  maxClassification: ClassificationLevel;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  scope: 'Company' | 'Personal' | 'Conversation';
  ownerUserId: string | null;
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: string;
  isActive: boolean;
  createdAt: string;
  lastIndexedAt: string | null;
  documentCount: number;
  chunkCount: number;
}

export type DocumentStatus =
  | 'Uploaded' | 'Validating' | 'Extracting' | 'Chunking' | 'Embedding'
  | 'Indexed' | 'Failed' | 'Archived';

export interface DocumentItem {
  id: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: DocumentStatus;
  errorMessage: string | null;
  chunkCount: number;
  version: number;
  classification: ClassificationLevel;
  isEphemeral: boolean;
  createdAt: string;
  indexedAt: string | null;
  uploadedBy: string;
}

export interface Chunk {
  id: string;
  ordinal: number;
  locator: string | null;
  tokenEstimate: number;
  preview: string;
}

export interface KnowledgeBaseLink {
  knowledgeBaseId: string;
  name: string;
  priority: number;
}

export interface Chatbot {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  ragEnabled: boolean;
  citationsEnabled: boolean;
  topK: number;
  rerankTopN: number;
  similarityThreshold: number;
  hybridSearch: boolean;
  queryRewriting: boolean;
  responseLanguage: string;
  welcomeMessage: string;
  suggestedQuestions: string[];
  allowUserUpload: boolean;
  conversationTimeoutMinutes: number;
  keepChatHistory: boolean;
  isActive: boolean;
  createdAt: string;
  knowledgeBases: KnowledgeBaseLink[];
}

export interface Citation {
  index: number;
  documentId: string;
  fileName: string;
  locator: string | null;
  knowledgeBase: string;
  score: number;
  snippet: string;
}

export interface Conversation {
  id: string;
  chatbotId: string;
  chatbotName: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  role: 'User' | 'Assistant' | 'System';
  content: string;
  citations: Citation[];
  model: string | null;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  noAnswer: boolean;
  feedback: 'None' | 'ThumbsUp' | 'ThumbsDown';
  createdAt: string;
  /** Client-only marker for the streaming placeholder row. */
  pending?: boolean;
}

export interface ChatResponse {
  conversationId: string;
  message: ChatMessage;
  followUpQuestions: string[];
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface NameCount {
  name: string;
  count: number;
}

export interface AnalyticsSummary {
  users: number;
  chatbots: number;
  knowledgeBases: number;
  documents: number;
  chunks: number;
  conversations: number;
  questions: number;
  successRatePct: number;
  noAnswerRatePct: number;
  avgResponseTimeSec: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  thumbsUp: number;
  thumbsDown: number;
  questionsPerDay: SeriesPoint[];
  topChatbots: NameCount[];
  topKnowledgeBases: NameCount[];
  failedDocuments: number;
}

export interface AuditEntry {
  id: number;
  userEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  timestamp: string;
  /** Only populated for super admins, whose view spans every tenant. */
  tenantName?: string | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProviderStatus {
  llm: string;
  embeddings: string;
  vectorStore: string;
  storage: string;
  database: string;
  liveLlm: boolean;
  notice: string | null;
}
