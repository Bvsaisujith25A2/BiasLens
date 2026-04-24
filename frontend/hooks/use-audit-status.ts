"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, JobStatusResponse, JobStatus } from "@/lib/api";
import { config } from "@/lib/config";

export interface UseAuditStatusOptions {
  /** Polling interval in milliseconds (default: 5000) */
  pollingInterval?: number;
  /** Maximum polling attempts before giving up (default: 120) */
  maxAttempts?: number;
  /** Called when job completes successfully */
  onComplete?: (results: JobStatusResponse) => void;
  /** Called when job fails */
  onFailed?: (error: string) => void;
  /** Called when polling times out */
  onTimeout?: () => void;
}

export interface UseAuditStatusReturn {
  /** Current job status data */
  status: JobStatusResponse | null;
  /** Whether polling is active */
  isPolling: boolean;
  /** Error message if any */
  error: string | null;
  /** Number of poll attempts made */
  attemptCount: number;
  /** Start polling for a job */
  startPolling: (jobId: string) => void;
  /** Stop polling */
  stopPolling: () => void;
  /** Reset the hook state */
  reset: () => void;
}

export function useAuditStatus(
  options: UseAuditStatusOptions = {}
): UseAuditStatusReturn {
  const {
    pollingInterval = config.polling.interval,
    maxAttempts = config.polling.maxAttempts,
    onComplete,
    onFailed,
    onTimeout,
  } = options;

  const [status, setStatus] = useState<JobStatusResponse | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  const jobIdRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const attemptRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const pollJobStatus = useCallback(async () => {
    if (!jobIdRef.current) return;

    attemptRef.current += 1;
    setAttemptCount(attemptRef.current);

    // Check for max attempts
    if (attemptRef.current > maxAttempts) {
      stopPolling();
      setError("Analysis is taking longer than expected. Please check back later.");
      onTimeout?.();
      return;
    }

    try {
      const jobStatus = await api.getJobStatus(jobIdRef.current);
      setStatus(jobStatus);
      setError(null);

      // Check terminal states
      if (jobStatus.status === "COMPLETED") {
        stopPolling();
        onComplete?.(jobStatus);
      } else if (jobStatus.status === "FAILED") {
        stopPolling();
        const errorMsg = jobStatus.error_message || "Analysis failed. Please try again.";
        setError(errorMsg);
        onFailed?.(errorMsg);
      }
    } catch (err) {
      // Don't stop polling on transient errors, just log them
      console.error("[BiasLens] Poll error:", err);
      
      // After 3 consecutive errors, show a warning but keep polling
      if (attemptRef.current % 3 === 0) {
        setError("Having trouble connecting. Retrying...");
      }
    }
  }, [maxAttempts, stopPolling, onComplete, onFailed, onTimeout]);

  const startPolling = useCallback(
    (jobId: string) => {
      // Clear any existing polling
      stopPolling();
      
      // Reset state
      jobIdRef.current = jobId;
      attemptRef.current = 0;
      setAttemptCount(0);
      setError(null);
      setStatus(null);
      setIsPolling(true);

      // Initial poll immediately
      pollJobStatus();

      // Set up interval polling
      intervalRef.current = setInterval(pollJobStatus, pollingInterval);
    },
    [pollJobStatus, pollingInterval, stopPolling]
  );

  const reset = useCallback(() => {
    stopPolling();
    jobIdRef.current = null;
    attemptRef.current = 0;
    setAttemptCount(0);
    setStatus(null);
    setError(null);
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    status,
    isPolling,
    error,
    attemptCount,
    startPolling,
    stopPolling,
    reset,
  };
}

// Helper to get human-readable status
export function getStatusMessage(status: JobStatus | null): string {
  switch (status) {
    case "PENDING":
      return "Waiting in queue...";
    case "PROCESSING":
      return "Analyzing dataset for bias...";
    case "COMPLETED":
      return "Analysis complete!";
    case "FAILED":
      return "Analysis failed";
    default:
      return "Preparing...";
  }
}

// Helper to get progress percentage estimate
export function getEstimatedProgress(
  status: JobStatus | null,
  actualProgress?: number
): number {
  if (actualProgress !== undefined) return actualProgress;
  
  switch (status) {
    case "PENDING":
      return 10;
    case "PROCESSING":
      return 50;
    case "COMPLETED":
      return 100;
    case "FAILED":
      return 0;
    default:
      return 0;
  }
}
