"use client";

import { useState, useCallback } from "react";
import { api, UploadProgress, UploadStep, UPLOAD_STEP_MESSAGES } from "@/lib/api";
import { config } from "@/lib/config";

export interface UseDatasetUploadOptions {
  onSuccess?: (jobId: string) => void;
  onError?: (error: Error) => void;
}

export function useDatasetUpload(options: UseDatasetUploadOptions = {}) {
  const [progress, setProgress] = useState<UploadProgress>({
    step: "idle",
    progress: 0,
    message: UPLOAD_STEP_MESSAGES.idle,
  });
  const [isUploading, setIsUploading] = useState(false);

  const updateProgress = (step: UploadStep, progressValue: number, error?: string) => {
    setProgress({
      step,
      progress: progressValue,
      message: error || UPLOAD_STEP_MESSAGES[step],
      error,
    });
  };

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    const maxSizeBytes = config.upload.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File is too large. Maximum size is ${config.upload.maxFileSizeMB}MB.`;
    }

    // Check file extension
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!config.upload.allowedExtensions.includes(extension)) {
      return `Invalid file type. Allowed types: ${config.upload.allowedExtensions.join(", ")}`;
    }

    return null;
  }, []);

  const uploadDataset = useCallback(
    async (file: File, datasetName?: string): Promise<string | null> => {
      // Validate file first
      const validationError = validateFile(file);
      if (validationError) {
        updateProgress("failed", 0, validationError);
        options.onError?.(new Error(validationError));
        return null;
      }

      setIsUploading(true);
      updateProgress("requesting_url", 10);

      try {
        // Step 1: Get presigned URL
        const presignedData = await api.getPresignedUrl({
          filename: file.name,
          file_size: file.size,
          content_type: file.type || "application/octet-stream",
        });

        updateProgress("uploading", 30);

        // Step 2: Upload to S3
        await api.uploadToS3(presignedData.presigned_url, file);

        updateProgress("starting_analysis", 60);

        // Step 3: Start the ML job
        const jobData = await api.startJob({
          s3_object_uri: presignedData.s3_object_uri,
          dataset_name: datasetName || file.name,
          analysis_options: {
            check_class_imbalance: true,
            check_source_variability: true,
            detect_hidden_bias: true,
          },
        });

        updateProgress("processing", 70);
        
        setProgress((prev) => ({
          ...prev,
          step: "processing",
          progress: 70,
          message: "Analyzing dataset for bias...",
          jobId: jobData.job_id,
        }));

        options.onSuccess?.(jobData.job_id);
        return jobData.job_id;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Upload failed";
        updateProgress("failed", 0, errorMessage);
        options.onError?.(error instanceof Error ? error : new Error(errorMessage));
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [validateFile, options]
  );

  const reset = useCallback(() => {
    setProgress({
      step: "idle",
      progress: 0,
      message: UPLOAD_STEP_MESSAGES.idle,
    });
    setIsUploading(false);
  }, []);

  return {
    progress,
    isUploading,
    uploadDataset,
    validateFile,
    reset,
  };
}
