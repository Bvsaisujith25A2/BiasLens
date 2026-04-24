"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorBoundary } from "react-error-boundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatasetUpload } from "@/components/dataset-upload";
import { AuditDashboard } from "@/components/audit-dashboard";
import { ErrorFallback } from "@/components/error-fallback";
import { Upload, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

export default function DashboardPage() {
  const { user, addAnalysis } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dashboard");

  const handleAnalysisComplete = useCallback((jobId: string) => {
    // Add a new processing analysis entry
    addAnalysis({
      id: jobId,
      name: `Analysis ${jobId.slice(0, 8)}`,
      datasetName: "Uploaded Dataset",
      createdAt: new Date(),
      status: "processing",
      fairnessScore: 0,
      diversityScore: 0,
      totalSamples: 0,
      biasWarnings: 0,
    });
    // Switch to dashboard tab to show progress
    setActiveTab("dashboard");
  }, [addAnalysis]);

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">Bias Analysis Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Upload datasets and analyze them for potential biases
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:max-w-md">
          <TabsTrigger value="upload" className="gap-1 text-xs sm:gap-2 sm:text-sm">
            <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Dataset</span> Upload
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1 text-xs sm:gap-2 sm:text-sm">
            <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Audit</span> Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-6">
          <ErrorBoundary
            FallbackComponent={(props) => (
              <ErrorFallback {...props} title="Something went wrong loading the upload module" />
            )}
          >
            <DatasetUpload onAnalysisComplete={handleAnalysisComplete} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="dashboard" className="mt-6">
          <ErrorBoundary
            FallbackComponent={(props) => (
              <ErrorFallback {...props} title="Something went wrong loading the audit dashboard" />
            )}
          >
            <AuditDashboard />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
