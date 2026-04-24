"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Gauge, BarChart3, Database, CheckCircle2 } from "lucide-react";
import type { BiasMetrics } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MetricsCardsProps {
  metrics: BiasMetrics;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function getScoreBackground(score: number): string {
  if (score >= 80) return "bg-green-100";
  if (score >= 60) return "bg-amber-100";
  return "bg-red-100";
}

function getProgressColor(score: number): string {
  if (score >= 80) return "[&>div]:bg-green-500";
  if (score >= 60) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-500";
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
      {/* Fairness Score */}
      <Card className="relative overflow-hidden">
        <div className={cn("absolute inset-x-0 top-0 h-1", metrics.fairnessScore >= 80 ? "bg-green-500" : metrics.fairnessScore >= 60 ? "bg-amber-500" : "bg-red-500")} />
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Fairness Score
          </CardTitle>
          <div className={cn("rounded-full p-2", getScoreBackground(metrics.fairnessScore))}>
            <Gauge className={cn("h-4 w-4", getScoreColor(metrics.fairnessScore))} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-1">
            <span className={cn("text-3xl font-bold", getScoreColor(metrics.fairnessScore))}>
              {metrics.fairnessScore}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <Progress
            value={metrics.fairnessScore}
            className={cn("mt-3 h-2", getProgressColor(metrics.fairnessScore))}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {metrics.fairnessScore >= 80
              ? "Excellent demographic parity"
              : metrics.fairnessScore >= 60
              ? "Review recommended"
              : "Significant bias detected"}
          </p>
        </CardContent>
      </Card>

      {/* Diversity Score */}
      <Card className="relative overflow-hidden">
        <div className={cn("absolute inset-x-0 top-0 h-1", metrics.diversityScore >= 80 ? "bg-green-500" : metrics.diversityScore >= 60 ? "bg-amber-500" : "bg-red-500")} />
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Diversity Score
          </CardTitle>
          <div className={cn("rounded-full p-2", getScoreBackground(metrics.diversityScore))}>
            <BarChart3 className={cn("h-4 w-4", getScoreColor(metrics.diversityScore))} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-1">
            <span className={cn("text-3xl font-bold", getScoreColor(metrics.diversityScore))}>
              {metrics.diversityScore}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <Progress
            value={metrics.diversityScore}
            className={cn("mt-3 h-2", getProgressColor(metrics.diversityScore))}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {metrics.diversityScore >= 80
              ? "Well-balanced representation"
              : metrics.diversityScore >= 60
              ? "Moderate diversity gaps"
              : "Severe underrepresentation"}
          </p>
        </CardContent>
      </Card>

      {/* Total Samples */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Samples
          </CardTitle>
          <div className="rounded-full bg-slate-100 p-2">
            <Database className="h-4 w-4 text-slate-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">
            {metrics.totalSamples.toLocaleString()}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Medical imaging samples loaded
          </p>
        </CardContent>
      </Card>

      {/* Analyzed Samples */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Analyzed
          </CardTitle>
          <div className="rounded-full bg-green-100 p-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">
            {metrics.analyzedSamples.toLocaleString()}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            100% analysis complete
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
