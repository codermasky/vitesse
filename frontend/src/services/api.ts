import axios from "axios";
import type { AxiosInstance, AxiosResponse } from "axios";

// Define API base URL - using environment variable with fallback
const VITE_API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:9001/api/v1";
const API_BASE_URL = VITE_API_URL.endsWith("/api/v1")
  ? VITE_API_URL
  : `${VITE_API_URL}/api/v1`;

class ApiService {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("access_token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    // Response interceptor to handle token refresh or logout
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem("access_token");
          window.location.href = "/login";
        }
        return Promise.reject(error);
      },
    );
  }

  public get(url: string, config?: any): Promise<AxiosResponse> {
    return this.axiosInstance.get(url, config);
  }

  public post(url: string, data?: any, config?: any): Promise<AxiosResponse> {
    return this.axiosInstance.post(url, data, config);
  }

  public put(url: string, data?: any, config?: any): Promise<AxiosResponse> {
    return this.axiosInstance.put(url, data, config);
  }

  public delete(url: string, config?: any): Promise<AxiosResponse> {
    return this.axiosInstance.delete(url, config);
  }

  public getMonitoringDashboard(limitEvents: number = 20): Promise<AxiosResponse> {
    return this.axiosInstance.get("/monitoring/dashboard", {
      params: { limit_events: limitEvents }
    });
  }

  getBaseUrl(): string {
    return API_BASE_URL;
  }

  async listAgents(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/agents/");
  }

  async getPipelineStructure(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/agents/pipeline");
  }

  async sendAgentChat(
    message: string,
    context: { flags: string[]; checklist: any },
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post("/agents/chat", { message, ...context });
  }

  async orchestrateAgents(data: any): Promise<AxiosResponse> {
    return this.axiosInstance.post("/agents/orchestrate", data);
  }

  async getLLMSettings(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/llm-configs/");
  }

  async addLLMProvider(config: any): Promise<AxiosResponse> {
    return this.axiosInstance.post("/llm-configs/providers", config);
  }

  async updateLLMProvider(
    providerId: string,
    update: any,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.put(
      `/llm-configs/providers/${providerId}`,
      update,
    );
  }

  async deleteLLMProvider(providerId: string): Promise<AxiosResponse> {
    return this.axiosInstance.delete(`/llm-configs/providers/${providerId}`);
  }

  async updateAgentMapping(mapping: any): Promise<AxiosResponse> {
    return this.axiosInstance.post("/llm-configs/mappings", mapping);
  }

  async deleteAgentMapping(agentId: string): Promise<AxiosResponse> {
    return this.axiosInstance.delete(`/llm-configs/mappings/${agentId}`);
  }

  async testLLMConnection(providerId: string): Promise<AxiosResponse> {
    return this.axiosInstance.post(
      `/llm-configs/test-connection/${providerId}`,
    );
  }

  async testAgentMapping(agentId: string): Promise<AxiosResponse> {
    return this.axiosInstance.post(`/llm-configs/test-agent/${agentId}`);
  }

  async getVisionStatus(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/llm-configs/vision-enabled");
  }

  async setVisionStatus(enabled: boolean): Promise<AxiosResponse> {
    return this.axiosInstance.post("/llm-configs/vision-enabled", null, {
      params: { enabled },
    });
  }

  async getDevilAdvocateStatus(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/llm-configs/devils-advocate-enabled");
  }

  async setDevilAdvocateStatus(enabled: boolean): Promise<AxiosResponse> {
    return this.axiosInstance.post(
      "/llm-configs/devils-advocate-enabled",
      null,
      { params: { enabled } },
    );
  }

  async getPromptHistory(agentId: string): Promise<AxiosResponse> {
    return this.axiosInstance.get(`/llm-configs/prompts/history/${agentId}`);
  }

  async revertPromptVersion(
    agentId: string,
    historyId: number,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post(
      `/llm-configs/prompts/revert/${agentId}/${historyId}`,
    );
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<AxiosResponse> {
    return this.axiosInstance.post(
      "/auth/access-token",
      new URLSearchParams({
        username: email,
        password,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );
  }

  async register(userData: {
    email: string;
    password: string;
    full_name?: string;
  }): Promise<AxiosResponse> {
    return this.axiosInstance.post("/auth/register", userData);
  }

  async getCurrentUser(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/auth/me");
  }

  // Azure AD SSO endpoints
  async getAzureADLoginUrl(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/auth/azure-ad/login-url");
  }

  async azureADCallback(code: string, state: string): Promise<AxiosResponse> {
    return this.axiosInstance.post("/auth/azure-ad/callback", null, {
      params: { code, state },
    });
  }

  // Chat endpoints
  async createChatSession(): Promise<AxiosResponse> {
    return this.axiosInstance.post("/chat/sessions");
  }

  async getChatSessions(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/chat/sessions");
  }

  async saveChatSession(sessionId: string): Promise<AxiosResponse> {
    return this.axiosInstance.post(`/chat/sessions/${sessionId}/save`);
  }

  async deleteChatSession(sessionId: string): Promise<AxiosResponse> {
    return this.axiosInstance.delete(`/chat/sessions/${sessionId}`);
  }

  async getChatHistory(sessionId: string): Promise<AxiosResponse> {
    return this.axiosInstance.get(`/chat/sessions/${sessionId}/history/`);
  }

  async getChatStats(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/chat/stats/");
  }

  // Documents endpoints
  async getDocuments(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/documents/");
  }

  async uploadDocument(
    file: File,
    docType: string = "vault",
    productId?: string,
    deploymentType?: string,
  ): Promise<AxiosResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("doc_type", docType);
    if (productId) formData.append("product_id", productId);
    if (deploymentType) formData.append("deployment_type", deploymentType);

    return this.axiosInstance.post("/documents/", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  }

  async deleteDocument(documentId: string): Promise<AxiosResponse> {
    return this.axiosInstance.delete(`/documents/${documentId}/`);
  }

  async getDocumentDetails(documentId: string): Promise<AxiosResponse> {
    return this.axiosInstance.get(`/documents/${documentId}/details/`);
  }

  async updateDocumentMetadata(
    documentId: string,
    metadata: {
      name?: string;
      description?: string;
      tags?: string[];
      author?: string;
      version?: string;
      language?: string;
      category?: string;
      doc_type?: string;
      access_level?: string;
      product_id?: string;
      deployment_type?: string;
      custom_metadata?: Record<string, any>;
    },
  ): Promise<AxiosResponse> {
    return this.axiosInstance.put(
      `/documents/${documentId}/metadata`,
      metadata,
    );
  }

  async renameDocument(
    documentId: string,
    newName: string,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.put(`/documents/${documentId}/rename/`, {
      new_name: newName,
    });
  }

  async addDocumentTags(
    documentId: string,
    tags: string[],
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post(`/documents/${documentId}/tags/`, { tags });
  }

  async removeDocumentTags(
    documentId: string,
    tags: string[],
  ): Promise<AxiosResponse> {
    return this.axiosInstance.delete(`/documents/${documentId}/tags/`, {
      data: { tags },
    });
  }

  async getExtractionFlow(documentId: string): Promise<AxiosResponse> {
    return this.axiosInstance.get(`/documents/${documentId}/extraction-flow/`);
  }

  async revectorizeDocument(documentId: string): Promise<AxiosResponse> {
    return this.axiosInstance.post(`/documents/${documentId}/revectorize/`);
  }

  async getDocumentChunks(
    documentId: string,
    page: number = 0,
    limit: number = 10,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.get(`/documents/${documentId}/chunks/`, {
      params: { page, limit },
    });
  }

  async getDocumentIndexedStats(documentId: string): Promise<AxiosResponse> {
    return this.axiosInstance.get(`/documents/${documentId}/indexed-stats/`);
  }

  async getAllTags(): Promise<AxiosResponse> {
    return this.axiosInstance.get(`/documents/tags/all/`);
  }

  async getKnowledgeBaseStats(): Promise<AxiosResponse> {
    return this.axiosInstance.get(`/knowledge-base/stats/`);
  }

  async deleteDocumentsBulk(documentIds: string[]): Promise<AxiosResponse> {
    return this.axiosInstance.post("/documents/bulk/delete/", {
      document_ids: documentIds,
    });
  }

  async updateDocumentsBulk(
    documentIds: string[],
    productId?: string,
    deploymentType?: string,
  ): Promise<AxiosResponse> {
    const payload: any = {
      document_ids: documentIds,
    };
    if (productId !== undefined) payload.product_id = productId;
    if (deploymentType !== undefined) payload.deployment_type = deploymentType;

    return this.axiosInstance.post("/documents/bulk/update/", payload);
  }

  async uploadDocumentsBulk(
    files: FileList | File[],
    docType: string = "vault",
    productId?: string,
    deploymentType?: string,
  ): Promise<any> {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });
    formData.append("doc_type", docType);
    if (productId) formData.append("product_id", productId);
    if (deploymentType) formData.append("deployment_type", deploymentType);

    return this.axiosInstance.post("/documents/upload-multiple", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  }

  // SharePoint endpoints
  async getSharePointConfig(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/sharepoint/config/");
  }

  async updateSharePointConfig(config: any): Promise<AxiosResponse> {
    return this.axiosInstance.post("/sharepoint/config/", config);
  }

  async testSharePointAuth(): Promise<AxiosResponse> {
    return this.axiosInstance.post("/sharepoint/auth/test/");
  }

  async analyzeSharePointSetup(): Promise<AxiosResponse> {
    return this.axiosInstance.post("/sharepoint/setup/analyze/");
  }

  async configureSharePointSetup(config: any): Promise<AxiosResponse> {
    return this.axiosInstance.post("/sharepoint/setup/configure/", config);
  }

  async fullSharePointSetup(): Promise<AxiosResponse> {
    return this.axiosInstance.post("/sharepoint/setup/full/");
  }

  async getSharePointSetupInstructions(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/sharepoint/setup/instructions/");
  }

  async getSharePointStatus(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/sharepoint/status");
  }

  async discoverSharePointDocuments(
    folderPath?: string,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.get("/sharepoint/documents/", {
      params: { folder_path: folderPath || "" },
    });
  }

  async indexSharePointDocuments(
    folderPath?: string,
    forceReindex?: boolean,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post("/sharepoint/documents/index/", {
      folder_path: folderPath || "",
      force_reindex: forceReindex || false,
    });
  }

  async syncSharePointDocuments(folderPath?: string): Promise<AxiosResponse> {
    return this.axiosInstance.post("/sharepoint/documents/sync/", {
      folder_path: folderPath || "",
    });
  }

  async downloadSharePointDocument(documentId: string): Promise<AxiosResponse> {
    return this.axiosInstance.get(
      `/sharepoint/documents/${documentId}/download/`,
    );
  }

  async uploadSharePointDocument(
    localPath: string,
    remotePath: string,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post("/sharepoint/documents/upload/", {
      local_path: localPath,
      remote_path: remotePath,
    });
  }

  // User management endpoints
  async getUsers(params?: {
    skip?: number;
    limit?: number;
  }): Promise<AxiosResponse> {
    return this.axiosInstance.get("/users/", { params });
  }

  async createUser(userData: {
    email: string;
    password: string;
    full_name?: string;
    is_active?: boolean;
    is_superuser?: boolean;
  }): Promise<AxiosResponse> {
    return this.axiosInstance.post("/users/", userData);
  }

  async getUser(userId: number): Promise<AxiosResponse> {
    return this.axiosInstance.get(`/users/${userId}`);
  }

  async updateUser(
    userId: number,
    userData: {
      email?: string;
      full_name?: string;
      is_active?: boolean;
      is_superuser?: boolean;
      password?: string;
    },
  ): Promise<AxiosResponse> {
    return this.axiosInstance.put(`/users/${userId}`, userData);
  }

  async updateCurrentUser(userData: {
    full_name?: string;
    password?: string;
  }): Promise<AxiosResponse> {
    return this.axiosInstance.put("/users/me", userData);
  }

  async deleteUser(userId: number): Promise<AxiosResponse> {
    return this.axiosInstance.delete(`/users/${userId}`);
  }

  // Email Integration endpoints
  async getEmailConfig(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/queue/email/config");
  }

  async updateEmailConfig(config: {
    enabled: boolean;
    server: string;
    port: number;
    username: string;
    password: string;
    poll_interval: number;
  }): Promise<AxiosResponse> {
    return this.axiosInstance.post("/queue/email/config", config);
  }

  async testEmailConnection(config: {
    enabled: boolean;
    server: string;
    port: number;
    username: string;
    password: string;
    poll_interval: number;
  }): Promise<AxiosResponse> {
    return this.axiosInstance.post("/queue/email/test", config);
  }

  async downloadDocument(url: string): Promise<AxiosResponse<Blob>> {
    return this.axiosInstance.get(url, {
      responseType: "blob",
    });
  }

  getDownloadUrl(documentId: string, inline: boolean = false): string {
    const token = localStorage.getItem("access_token");
    const baseUrl = `${API_BASE_URL}/documents/${documentId}/download`;
    const params = new URLSearchParams();
    if (token) params.append("token", token);
    if (inline) params.append("inline", "true");

    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  }

  async getSystemStatus(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/system/status");
  }

  // Azure AD SSO endpoints
  async getAzureADConfig(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/system/azure-ad/config");
  }

  async updateAzureADConfig(config: any): Promise<AxiosResponse> {
    return this.axiosInstance.post("/system/azure-ad/config", config);
  }

  async testAzureADConfig(): Promise<AxiosResponse> {
    return this.axiosInstance.post("/system/azure-ad/test");
  }

  async automateAzureADSetup(config: {
    tenant_id: string;
    access_token: string;
    app_name?: string;
    redirect_uri?: string;
  }): Promise<AxiosResponse> {
    return this.axiosInstance.post("/system/azure-ad/automate-setup", config);
  }

  async troubleshootAzureAD(): Promise<AxiosResponse> {
    return this.axiosInstance.post("/system/azure-ad/troubleshoot");
  }

  async getProducts(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/system/products");
  }

  async updateProducts(products: string[]): Promise<AxiosResponse> {
    return this.axiosInstance.post("/system/products", products);
  }

  // Admin / Observability endpoints
  async getAdminHealth(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/admin/health");
  }

  async getAdminAuditLogs(limit: number = 50): Promise<AxiosResponse> {
    return this.axiosInstance.get("/admin/audit-logs", { params: { limit } });
  }

  async getAdminAnalytics(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/admin/analytics");
  }

  async getFeatureFlags(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/admin/feature-flags");
  }

  async updateFeatureFlags(
    flags: Record<string, boolean>,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.put("/admin/feature-flags", flags);
  }

  async updateFeatureFlag(
    feature: string,
    enabled: boolean,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.put(`/admin/feature-flags/${feature}`, {
      enabled,
    });
  }

  // LangFuse endpoints
  async getLangfuseConfig(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/langfuse-config");
  }

  async updateLangfuseConfig(config: any): Promise<AxiosResponse> {
    return this.axiosInstance.post("/langfuse-config", config);
  }

  async testLangfuseConfigConnection(): Promise<AxiosResponse> {
    return this.axiosInstance.post("/langfuse-config/test");
  }

  async runLangfuseAutoSetup(): Promise<AxiosResponse> {
    return this.axiosInstance.post("/langfuse-config/setup");
  }

  async getLangfuseDashboardInfo(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/monitoring/dashboard");
  }

  async getLangfuseStats(hours: number = 24): Promise<AxiosResponse> {
    return this.axiosInstance.get("/monitoring/llm-calls", {
      params: { hours },
    });
  }

  // Harvest Sources endpoints
  async getHarvestSources(params?: {
    skip?: number;
    limit?: number;
    enabled_only?: boolean;
    source_type?: string;
    category?: string;
  }): Promise<AxiosResponse> {
    return this.axiosInstance.get("/harvest-sources/", { params });
  }

  async getHarvestSource(sourceId: number): Promise<AxiosResponse> {
    return this.axiosInstance.get(`/harvest-sources/${sourceId}`);
  }

  async createHarvestSource(sourceData: any): Promise<AxiosResponse> {
    return this.axiosInstance.post("/harvest-sources/", sourceData);
  }

  async updateHarvestSource(
    sourceId: number,
    updateData: any,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.put(`/harvest-sources/${sourceId}`, updateData);
  }

  async deleteHarvestSource(sourceId: number): Promise<AxiosResponse> {
    return this.axiosInstance.delete(`/harvest-sources/${sourceId}`);
  }

  async testHarvestSource(sourceId: number): Promise<AxiosResponse> {
    return this.axiosInstance.post(`/harvest-sources/${sourceId}/test`);
  }

  async getHarvestStats(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/harvest-sources/stats/overview");
  }

  async initializeDefaultHarvestSources(): Promise<AxiosResponse> {
    return this.axiosInstance.post("/harvest-sources/initialize-defaults");
  }

  // Search for harvest sources on the web
  async searchHarvestSources(
    query: string,
    sourceType?: string
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post("/harvest-sources/search", null, {
      params: { query, source_type: sourceType },
    });
  }

  // Harvest Jobs endpoints
  async getHarvestJobs(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    harvest_type?: string;
  }): Promise<AxiosResponse> {
    return this.axiosInstance.get("/harvest-jobs/", { params });
  }

  async getHarvestJob(jobId: string): Promise<AxiosResponse> {
    return this.axiosInstance.get(`/harvest-jobs/${jobId}`);
  }

  async createHarvestJob(jobData: {
    harvest_type: string;
    source_ids?: number[];
  }): Promise<AxiosResponse> {
    return this.axiosInstance.post("/harvest-jobs/", jobData);
  }

  async cancelHarvestJob(jobId: string): Promise<AxiosResponse> {
    return this.axiosInstance.post(`/harvest-jobs/${jobId}/cancel`);
  }

  async deleteHarvestJob(jobId: string): Promise<AxiosResponse> {
    return this.axiosInstance.delete(`/harvest-jobs/${jobId}`);
  }

  async bulkDeleteHarvestJobs(jobIds: string[]): Promise<AxiosResponse> {
    return this.axiosInstance.post("/harvest-jobs/bulk-delete", jobIds);
  }

  async getHarvestJobStats(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/harvest-jobs/stats/overview");
  }

  // Agent Collaboration Hub endpoints
  async getSharedState(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/agent-collaboration/shared-state");
  }

  async getAgentActivity(hours?: number): Promise<AxiosResponse> {
    return this.axiosInstance.get("/agent-collaboration/agents/activity", {
      params: { hours },
    });
  }

  async getCommunicationLog(
    hours?: number,
    limit?: number,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.get("/agent-collaboration/communication/log", {
      params: { hours, limit },
    });
  }

  async getAgentMetrics(agentId: string): Promise<AxiosResponse> {
    return this.axiosInstance.get(
      `/agent-collaboration/agents/${agentId}/metrics`,
    );
  }

  async getCollaborationStats(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/agent-collaboration/stats/overview");
  }

  // Integration Builder endpoints
  async getIntegrations(params?: {
    skip?: number;
    limit?: number;
    status?: string;
  }): Promise<AxiosResponse> {
    return this.axiosInstance.get("/integration-builder/", { params });
  }

  async getIntegration(integrationId: string): Promise<AxiosResponse> {
    return this.axiosInstance.get(`/integration-builder/${integrationId}`);
  }

  async createIntegration(integrationData: {
    name: string;
    description: string;
    source_api: string;
    target_api: string;
  }): Promise<AxiosResponse> {
    return this.axiosInstance.post("/integration-builder/", integrationData);
  }

  async updateIntegration(
    integrationId: string,
    updateData: any,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.put(
      `/integration-builder/${integrationId}`,
      updateData,
    );
  }

  async deleteIntegration(integrationId: string): Promise<AxiosResponse> {
    return this.axiosInstance.delete(`/integration-builder/${integrationId}`);
  }

  async addFieldMapping(
    integrationId: string,
    mappingData: any,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post(
      `/integration-builder/${integrationId}/field-mappings`,
      mappingData,
    );
  }

  async addTransformationRule(
    integrationId: string,
    ruleData: any,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post(
      `/integration-builder/${integrationId}/transformations`,
      ruleData,
    );
  }

  async testIntegration(
    integrationId: string,
    testData: any,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post(
      `/integration-builder/${integrationId}/test`,
      testData,
    );
  }

  async deployIntegration(integrationId: string): Promise<AxiosResponse> {
    return this.axiosInstance.post(
      `/vitesse/integrations/${integrationId}/deploy`,
    );
  }

  async getIntegrationTestResults(
    integrationId: string,
    limit?: number,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.get(
      `/integration-builder/${integrationId}/test-results`,
      { params: { limit } },
    );
  }

  async getIntegrationStats(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/integration-builder/stats/overview");
  }

  // ==================== Vitesse Multi-Step Integration Workflow ====================

  // Step 1: Create integration from discovery results
  async getVitesseIntegrations(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/vitesse/integrations");
  }

  async createVitesseIntegration(payload: {
    name: string;
    source_discovery: any;
    dest_discovery: any;
    user_intent: string;
    deployment_target?: string;
    metadata?: any;
  }): Promise<AxiosResponse> {
    return this.axiosInstance.post("/vitesse/integrations", payload);
  }

  // Step 2: Ingest API specifications
  async ingestIntegrationSpecs(
    integrationId: string,
    payload: {
      source_spec_url?: string;
      dest_spec_url?: string;
    },
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post(
      `/vitesse/integrations/${integrationId}/ingest`,
      payload,
    );
  }

  // Step 3: Generate field mappings
  async mapIntegrationFields(
    integrationId: string,
    payload: {
      source_endpoint: string;
      dest_endpoint: string;
      mapping_hints?: any;
    },
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post(
      `/vitesse/integrations/${integrationId}/map`,
      payload,
    );
  }

  // Step 4: Run integration tests
  async testVitesseIntegration(
    integrationId: string,
    payload?: {
      test_sample_size?: number;
      skip_destructive?: boolean;
    },
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post(
      `/vitesse/integrations/${integrationId}/test`,
      payload || {},
    );
  }

  // Step 5: Deploy integration
  async deployVitesseIntegration(
    integrationId: string,
    payload?: {
      replicas?: number;
      memory_mb?: number;
      cpu_cores?: number;
      auto_scale?: boolean;
    },
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post(
      `/vitesse/integrations/${integrationId}/deploy`,
      payload || {},
    );
  }

  // Get integration details and status
  async getVitesseIntegrationStatus(
    integrationId: string,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.get(`/vitesse/integrations/${integrationId}`);
  }

  // Agent Activity Dashboard methods
  async getAgentActivitySharedState(): Promise<AxiosResponse> {
    return this.axiosInstance.get("/agents/shared-state");
  }

  async getWorkflowStatus(workflowId?: string): Promise<AxiosResponse> {
    const url = workflowId
      ? `/agents/workflow/${workflowId}`
      : "/agents/workflow";
    return this.axiosInstance.get(url);
  }

  async getAgentActivityMetrics(agentId?: string): Promise<AxiosResponse> {
    const url = agentId ? `/agents/${agentId}/metrics` : "/agents/metrics";
    return this.axiosInstance.get(url);
  }
}

export const apiService = new ApiService();
export default apiService;
