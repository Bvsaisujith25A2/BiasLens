// ============================================================================
// File Upload Types
// ============================================================================

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "validating" | "verified" | "checking" | "error";
  statusMessage: string;
  uploadedAt: Date;
}

// ============================================================================
// Bias Analysis Types
// ============================================================================

export interface BiasMetrics {
  fairnessScore: number;
  diversityScore: number;
  totalSamples: number;
  analyzedSamples: number;
}

export interface ClassImbalanceData {
  name: string;
  value: number;
  fill: string;
}

export interface SourceVariabilityData {
  source: string;
  count: number;
}

export interface BiasDetection {
  id: string;
  imageUrl: string;
  label: string;
  caption: string;
  severity: "high" | "medium" | "low";
}

// ============================================================================
// Analysis History Types
// ============================================================================

export type AnalysisStatus = "completed" | "processing" | "failed" | "pending";

export interface Analysis {
  id: string;
  name: string;
  datasetName: string;
  status: AnalysisStatus;
  fairnessScore: number;
  diversityScore: number;
  totalSamples: number;
  biasWarnings: number;
  createdAt: Date;
  completedAt?: Date;
}

// ============================================================================
// User Types
// ============================================================================

export type UserRole = "admin" | "researcher";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organization?: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

// ============================================================================
// Admin Dashboard Types
// ============================================================================

export interface AdminStats {
  totalUsers: number;
  activeAnalyses: number;
  totalDatasets: number;
  systemHealth: "healthy" | "degraded" | "down";
}

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  analyses: number;
  lastActive: Date;
  status: "active" | "inactive" | "suspended";
}

export interface ActivityLogItem {
  id: string;
  user: string;
  action: string;
  dataset: string;
  time: Date;
}

// ============================================================================
// API Response Mapping Utilities
// ============================================================================

/**
 * Maps API job status to frontend analysis status
 */
export function mapJobStatusToAnalysisStatus(
  jobStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED"
): AnalysisStatus {
  switch (jobStatus) {
    case "COMPLETED":
      return "completed";
    case "PROCESSING":
      return "processing";
    case "FAILED":
    case "CANCELLED":
      return "failed";
    case "PENDING":
    default:
      return "pending";
  }
}

/**
 * Maps API analysis history item to frontend Analysis type
 */
export function mapApiAnalysisToAnalysis(apiItem: {
  id: string;
  name: string;
  dataset_name: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  fairness_score?: number;
  diversity_score?: number;
  total_samples: number;
  bias_warnings: number;
  created_at: string;
  completed_at?: string;
}): Analysis {
  return {
    id: apiItem.id,
    name: apiItem.name,
    datasetName: apiItem.dataset_name,
    status: mapJobStatusToAnalysisStatus(apiItem.status),
    fairnessScore: apiItem.fairness_score || 0,
    diversityScore: apiItem.diversity_score || 0,
    totalSamples: apiItem.total_samples,
    biasWarnings: apiItem.bias_warnings,
    createdAt: new Date(apiItem.created_at),
    completedAt: apiItem.completed_at ? new Date(apiItem.completed_at) : undefined,
  };
}
