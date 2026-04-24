/**
 * Centralized API client for BiasLens backend communication
 * Handles all HTTP requests with proper error handling and TypeScript types
 */

import { getApiBaseUrl } from "./config";

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface PresignedUrlRequest {
  filename: string;
  file_size: number;
  content_type: string;
}

export interface PresignedUrlResponse {
  presigned_url: string;
  s3_object_uri: string;
  expires_in: number;
}

export interface JobStartRequest {
  s3_object_uri: string;
  dataset_name?: string;
  analysis_options?: {
    check_class_imbalance?: boolean;
    check_source_variability?: boolean;
    detect_hidden_bias?: boolean;
  };
}

export interface JobStartResponse {
  job_id: string;
  status: JobStatus;
  created_at: string;
  estimated_duration_seconds?: number;
}

export type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  progress?: number;
  current_step?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  error_message?: string;
  results?: JobResults;
}

export interface JobResults {
  fairness_score: number;
  diversity_score: number;
  total_samples: number;
  analyzed_samples: number;
  class_imbalance: {
    name: string;
    value: number;
    percentage: number;
  }[];
  source_variability: {
    source: string;
    count: number;
    percentage: number;
  }[];
  bias_detections: {
    id: string;
    image_url: string;
    label: string;
    caption: string;
    severity: "high" | "medium" | "low";
    confidence: number;
  }[];
  warnings: {
    type: string;
    message: string;
    severity: "critical" | "warning" | "info";
  }[];
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: "admin" | "researcher";
  organization?: string;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "researcher";
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface AnalysisHistoryItem {
  id: string;
  name: string;
  dataset_name: string;
  status: JobStatus;
  fairness_score?: number;
  diversity_score?: number;
  total_samples: number;
  bias_warnings: number;
  created_at: string;
  completed_at?: string;
}

export interface AnalysisHistoryResponse {
  analyses: AnalysisHistoryItem[];
  total: number;
  page: number;
  per_page: number;
}

// ============================================================================
// API Client Class
// ============================================================================

class ApiClient {
  private getBaseUrl(): string {
    return getApiBaseUrl();
  }

  private async handleResponse<T>(response: Response, endpoint?: string): Promise<T> {
    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // Response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }

      // Provide user-friendly messages for common errors.
      // Keep backend detail for auth endpoints so login/signup can show the real reason.
      const isAuthEndpoint = (endpoint || "").startsWith("/api/v1/auth/");
      if (response.status === 401 && !isAuthEndpoint) {
        throw new Error("Your session has expired. Please log in again.");
      }
      if (response.status === 401 && isAuthEndpoint) {
        throw new Error(errorMessage || "Invalid email or password.");
      }
      if (response.status === 403) {
        throw new Error("You don't have permission to perform this action.");
      }
      if (response.status === 404) {
        throw new Error("The requested resource was not found.");
      }
      if (response.status === 413) {
        throw new Error("The file is too large. Please upload a smaller file.");
      }
      if (response.status >= 500) {
        throw new Error("Server error. Please try again later or contact support.");
      }

      throw new Error(errorMessage);
    }

    return response.json();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    
    const defaultHeaders: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Get auth token from localStorage if available
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("auth_token");
      if (token) {
        (defaultHeaders as Record<string, string>)["Authorization"] = `Bearer ${token}`;
      }
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      return this.handleResponse<T>(response, endpoint);
    } catch (error) {
      // Handle network errors and CORS issues
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(
          "Unable to connect to the server. Please check your internet connection and try again."
        );
      }
      if (error instanceof Error && error.message.includes("CORS")) {
        throw new Error(
          "Connection blocked by security policy. Please contact support."
        );
      }
      throw error;
    }
  }

  // ============================================================================
  // Auth Endpoints
  // ============================================================================

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  }

  // ============================================================================
  // Upload Endpoints
  // ============================================================================

  /**
   * Step 1: Request a presigned URL for S3 upload
   */
  async getPresignedUrl(data: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    return this.request<PresignedUrlResponse>("/api/v1/upload/presigned-url", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Step 2: Upload file directly to S3 using presigned URL
   * Note: This bypasses the API client since it's a direct S3 request
   */
  async uploadToS3(presignedUrl: string, file: File): Promise<void> {
    try {
      const response = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!response.ok) {
        throw new Error(`S3 upload failed with status ${response.status}`);
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(
          "Failed to upload file to storage. Please check your connection and try again."
        );
      }
      throw error;
    }
  }

  /**
   * Step 3: Start the ML analysis job
   */
  async startJob(data: JobStartRequest): Promise<JobStartResponse> {
    return this.request<JobStartResponse>("/api/v1/jobs/start", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // Job Status Endpoints
  // ============================================================================

  /**
   * Get the current status of a job
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    return this.request<JobStatusResponse>(`/api/v1/jobs/${jobId}`);
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/v1/jobs/${jobId}/cancel`, {
      method: "POST",
    });
  }

  // ============================================================================
  // Analysis History Endpoints
  // ============================================================================

  /**
   * Get user's analysis history
   */
  async getAnalysisHistory(
    page: number = 1,
    perPage: number = 10
  ): Promise<AnalysisHistoryResponse> {
    return this.request<AnalysisHistoryResponse>(
      `/api/v1/analyses?page=${page}&per_page=${perPage}`
    );
  }

  /**
   * Get a specific analysis by ID
   */
  async getAnalysis(analysisId: string): Promise<JobStatusResponse> {
    return this.request<JobStatusResponse>(`/api/v1/analyses/${analysisId}`);
  }

  /**
   * Delete an analysis
   */
  async deleteAnalysis(analysisId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/v1/analyses/${analysisId}`, {
      method: "DELETE",
    });
  }

  // ============================================================================
  // User Endpoints
  // ============================================================================

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<UserProfile> {
    return this.request<UserProfile>("/api/v1/users/me");
  }

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    return this.request<UserProfile>("/api/v1/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }
}

// Export singleton instance
export const api = new ApiClient();

// ============================================================================
// Utility Types for Frontend
// ============================================================================

export type UploadStep = 
  | "idle"
  | "requesting_url"
  | "uploading"
  | "starting_analysis"
  | "processing"
  | "completed"
  | "failed";

export interface UploadProgress {
  step: UploadStep;
  progress: number;
  message: string;
  jobId?: string;
  error?: string;
}

export const UPLOAD_STEP_MESSAGES: Record<UploadStep, string> = {
  idle: "Ready to upload",
  requesting_url: "Requesting secure upload link...",
  uploading: "Uploading to secure storage...",
  starting_analysis: "Starting bias analysis...",
  processing: "Analyzing dataset for bias...",
  completed: "Analysis complete!",
  failed: "Upload failed",
};
