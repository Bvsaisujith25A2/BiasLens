"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileBarChart,
  Database,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Empty } from "@/components/ui/empty";
import { useAuth } from "@/contexts/auth-context";

export default function AnalysisPage() {
  const { user, analyses } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "processing":
        return <Clock className="h-4 w-4 text-blue-600 animate-pulse" />;
      case "failed":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Completed</Badge>;
      case "processing":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Processing</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-destructive";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Previous Analyses</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            View and manage your dataset bias analyses
          </p>
        </div>
        <Link href="/dashboard" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">New Analysis</Button>
        </Link>
      </div>

      {analyses.length === 0 ? (
        <Empty
          icon={<FileBarChart className="h-10 w-10" />}
          title="No analyses yet"
          description="Upload a dataset to start your first bias analysis"
          action={
            <Link href="/dashboard">
              <Button>Upload Dataset</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {analyses.map((analysis) => (
            <Card key={analysis.id} className="transition-colors hover:border-primary/50">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                  {/* Top row - Analysis info */}
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-12 sm:w-12">
                      {getStatusIcon(analysis.status)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{analysis.name}</h3>
                        {getStatusBadge(analysis.status)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          {analysis.datasetName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {analysis.createdAt.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom row - Scores */}
                  {analysis.status === "completed" ? (
                    <div className="flex flex-wrap items-center gap-3 border-t pt-4 sm:gap-6 sm:border-0 sm:pt-0 sm:justify-end">
                      <div className="flex gap-3 sm:gap-6">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Fairness</p>
                          <p className={`text-lg font-bold sm:text-xl ${getScoreColor(analysis.fairnessScore)}`}>
                            {analysis.fairnessScore}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Diversity</p>
                          <p className={`text-lg font-bold sm:text-xl ${getScoreColor(analysis.diversityScore)}`}>
                            {analysis.diversityScore}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Samples</p>
                          <p className="text-lg font-bold sm:text-xl">{analysis.totalSamples.toLocaleString()}</p>
                        </div>
                      </div>
                      {analysis.biasWarnings > 0 && (
                        <div className="flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm font-medium">{analysis.biasWarnings}</span>
                        </div>
                      )}
                      <Button variant="ghost" size="icon" className="ml-auto sm:ml-0">
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  ) : analysis.status === "processing" ? (
                    <div className="flex flex-wrap items-center gap-3 border-t pt-4 sm:gap-4 sm:border-0 sm:pt-0 sm:justify-end">
                      <div className="w-full sm:w-32">
                        <p className="mb-1 text-xs text-muted-foreground">Processing...</p>
                        <Progress value={45} className="h-2" />
                      </div>
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        View Progress
                      </Button>
                    </div>
                  ) : (
                    <div className="border-t pt-4 sm:border-0 sm:pt-0 sm:text-right">
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">
                        Retry
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {analyses.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Analyses</CardDescription>
              <CardTitle className="text-3xl">{analyses.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Samples Analyzed</CardDescription>
              <CardTitle className="text-3xl">
                {analyses.reduce((sum, a) => sum + a.totalSamples, 0).toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Bias Warnings</CardDescription>
              <CardTitle className="text-3xl text-amber-600">
                {analyses.reduce((sum, a) => sum + a.biasWarnings, 0)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}
    </div>
  );
}
