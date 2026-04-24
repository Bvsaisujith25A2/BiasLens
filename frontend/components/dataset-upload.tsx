"use client";

import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileImage,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Loader2,
  AlertCircle,
  X,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDatasetUpload } from "@/hooks/use-dataset-upload";
import { useAuditStatus, getStatusMessage, getEstimatedProgress } from "@/hooks/use-audit-status";
import type { UploadStep } from "@/lib/api";

interface FileItem {
  id: string;
  file: File;
  status: "pending" | "uploading" | "processing" | "completed" | "error";
  progress: number;
  message: string;
  jobId?: string;
  error?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1000000000) {
    return (bytes / 1000000000).toFixed(1) + " GB";
  }
  if (bytes >= 1000000) {
    return (bytes / 1000000).toFixed(1) + " MB";
  }
  if (bytes >= 1000) {
    return (bytes / 1000).toFixed(1) + " KB";
  }
  return bytes + " B";
}

function getFileIcon(type: string) {
  if (type.includes("csv") || type.includes("spreadsheet")) {
    return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  }
  if (type.includes("image") || type.includes("dicom")) {
    return <FileImage className="h-5 w-5 text-blue-600" />;
  }
  return <FileText className="h-5 w-5 text-slate-600" />;
}

function getStepProgress(step: UploadStep): number {
  switch (step) {
    case "idle": return 0;
    case "requesting_url": return 15;
    case "uploading": return 40;
    case "starting_analysis": return 60;
    case "processing": return 75;
    case "completed": return 100;
    case "failed": return 0;
    default: return 0;
  }
}

interface DatasetUploadProps {
  onAnalysisComplete?: (jobId: string) => void;
}

export function DatasetUpload({ onAnalysisComplete }: DatasetUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { progress, isUploading, uploadDataset, reset: resetUpload } = useDatasetUpload({
    onSuccess: (jobId) => {
      setActiveJobId(jobId);
      startPolling(jobId);
    },
    onError: (error) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "uploading"
            ? { ...f, status: "error", error: error.message, message: error.message }
            : f
        )
      );
    },
  });

  const { status: jobStatus, isPolling, error: pollError, startPolling, stopPolling, reset: resetPolling } = useAuditStatus({
    onComplete: (result) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.jobId === result.job_id
            ? { ...f, status: "completed", progress: 100, message: "Analysis complete!" }
            : f
        )
      );
      if (result.job_id) {
        onAnalysisComplete?.(result.job_id);
      }
    },
    onFailed: (errorMsg) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.jobId === activeJobId
            ? { ...f, status: "error", error: errorMsg, message: errorMsg }
            : f
        )
      );
    },
  });

  // Update file progress based on upload and polling status
  const updateFileProgress = useCallback((fileId: string, step: UploadStep, jobId?: string) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        
        const newProgress = getStepProgress(step);
        let status: FileItem["status"] = "uploading";
        
        if (step === "completed") status = "completed";
        else if (step === "failed") status = "error";
        else if (step === "processing") status = "processing";
        
        return {
          ...f,
          status,
          progress: newProgress,
          message: progress.message,
          jobId: jobId || f.jobId,
          error: progress.error,
        };
      })
    );
  }, [progress.message, progress.error]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: FileItem[] = Array.from(fileList).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      status: "pending" as const,
      progress: 0,
      message: "Waiting to upload...",
    }));

    setFiles((prev) => [...newFiles, ...prev]);

    // Process files sequentially
    for (const fileItem of newFiles) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id
            ? { ...f, status: "uploading", message: "Requesting secure upload link..." }
            : f
        )
      );

      const jobId = await uploadDataset(fileItem.file);
      
      if (jobId) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? { ...f, jobId, status: "processing", progress: 70, message: "Analyzing dataset for bias..." }
              : f
          )
        );
      }
    }
  }, [uploadDataset]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset input so same file can be selected again
      e.target.value = "";
    }
  }, [processFiles]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemoveFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const handleRetry = useCallback(async (fileItem: FileItem) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileItem.id
          ? { ...f, status: "uploading", progress: 0, message: "Retrying upload...", error: undefined }
          : f
      )
    );

    resetUpload();
    resetPolling();
    
    const jobId = await uploadDataset(fileItem.file);
    if (jobId) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id
            ? { ...f, jobId, status: "processing", progress: 70, message: "Analyzing dataset for bias..." }
            : f
        )
      );
    }
  }, [uploadDataset, resetUpload, resetPolling]);

  const getStatusBadge = (file: FileItem) => {
    switch (file.status) {
      case "completed":
        return (
          <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            Complete
          </Badge>
        );
      case "uploading":
      case "processing":
        return (
          <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            {file.message}
          </Badge>
        );
      case "error":
        return (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              <AlertCircle className="h-3 w-3" />
              Failed
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2"
              onClick={() => handleRetry(file)}
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          </div>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".jpg,.jpeg,.png,.dcm,.dicom,.csv"
        onChange={handleFileSelect}
      />

      {/* Drop Zone */}
      <Card
        className={cn(
          "border-2 border-dashed transition-all duration-200 cursor-pointer",
          isDragOver
            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
            : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
      >
        <CardContent className="flex flex-col items-center justify-center px-4 py-10 sm:py-16">
          <div
            className={cn(
              "mb-4 rounded-full p-3 transition-colors sm:p-4",
              isDragOver ? "bg-blue-100 dark:bg-blue-900" : "bg-slate-100 dark:bg-slate-800"
            )}
          >
            <Upload
              className={cn(
                "h-8 w-8 transition-colors sm:h-10 sm:w-10",
                isDragOver ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
              )}
            />
          </div>
          <h3 className="mb-2 text-base font-semibold text-foreground sm:text-lg">
            Drop your dataset files here
          </h3>
          <p className="mb-4 text-center text-xs text-muted-foreground sm:text-sm">
            Drag and drop your files, or click to browse
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">
              JPG
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs">
              PNG
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs">
              DICOM
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs">
              CSV (metadata)
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {isUploading && (
        <Card>
          <CardContent className="py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{progress.message}</span>
                <span className="text-muted-foreground">{Math.round(progress.progress)}%</span>
              </div>
              <Progress value={progress.progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Polling Status */}
      {isPolling && jobStatus && (
        <Card>
          <CardContent className="py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  {getStatusMessage(jobStatus.status)}
                </span>
                <span className="text-muted-foreground">
                  {Math.round(getEstimatedProgress(jobStatus.status, jobStatus.progress))}%
                </span>
              </div>
              <Progress 
                value={getEstimatedProgress(jobStatus.status, jobStatus.progress)} 
                className="h-2" 
              />
              {jobStatus.current_step && (
                <p className="text-xs text-muted-foreground">{jobStatus.current_step}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {pollError && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-200">{pollError}</p>
          </CardContent>
        </Card>
      )}

      {/* Recent Uploads */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">{getFileIcon(file.file.type)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {file.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.file.size)}
                        {file.error && (
                          <span className="ml-2 text-red-600 dark:text-red-400">
                            {file.error}
                          </span>
                        )}
                      </p>
                      {(file.status === "uploading" || file.status === "processing") && (
                        <Progress value={file.progress} className="mt-2 h-1" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getStatusBadge(file)}
                    {file.status !== "uploading" && file.status !== "processing" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRemoveFile(file.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
