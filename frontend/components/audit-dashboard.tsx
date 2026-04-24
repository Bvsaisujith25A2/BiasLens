"use client";

import { useMemo } from "react";
import { MetricsCards } from "./metrics-cards";
import { BiasWarning } from "./bias-warning";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

export function AuditDashboard() {
  const { analyses } = useAuth();

  const completed = useMemo(
    () => analyses.filter((analysis) => analysis.status === "completed"),
    [analyses]
  );

  const metrics = useMemo(() => {
    const totalSamples = completed.reduce((sum, item) => sum + item.totalSamples, 0);
    const fairnessScore =
      completed.length > 0
        ? Math.round(completed.reduce((sum, item) => sum + item.fairnessScore, 0) / completed.length)
        : 0;
    const diversityScore =
      completed.length > 0
        ? Math.round(completed.reduce((sum, item) => sum + item.diversityScore, 0) / completed.length)
        : 0;

    return {
      fairnessScore,
      diversityScore,
      totalSamples,
      analyzedSamples: totalSamples,
    };
  }, [completed]);

  const totalWarnings = useMemo(
    () => completed.reduce((sum, item) => sum + item.biasWarnings, 0),
    [completed]
  );

  if (analyses.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            No analysis results yet
          </CardTitle>
          <CardDescription>
            Upload a dataset and start an analysis to populate this dashboard with real metrics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your account is new, so seeing an empty history is expected.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <MetricsCards metrics={metrics} />

      {totalWarnings > 0 ? (
        <BiasWarning />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No critical bias warnings</CardTitle>
            <CardDescription>
              Completed analyses currently report zero bias warning flags.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Analysis Summary</CardTitle>
          <CardDescription>
            {completed.length} completed out of {analyses.length} total analysis jobs
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
