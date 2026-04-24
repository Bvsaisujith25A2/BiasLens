"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BiasDetection } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";

interface BiasDetectorProps {
  detections: BiasDetection[];
}

function getSeverityStyles(severity: BiasDetection["severity"]) {
  switch (severity) {
    case "high":
      return {
        badge: "bg-red-100 text-red-700 border-red-200",
        icon: <AlertTriangle className="h-3 w-3" />,
        overlay: "bg-gradient-to-br from-red-500/40 via-red-400/20 to-transparent",
        label: "High Severity",
      };
    case "medium":
      return {
        badge: "bg-amber-100 text-amber-700 border-amber-200",
        icon: <AlertCircle className="h-3 w-3" />,
        overlay: "bg-gradient-to-br from-amber-500/40 via-amber-400/20 to-transparent",
        label: "Medium Severity",
      };
    case "low":
      return {
        badge: "bg-blue-100 text-blue-700 border-blue-200",
        icon: <Info className="h-3 w-3" />,
        overlay: "bg-gradient-to-br from-blue-500/30 via-blue-400/15 to-transparent",
        label: "Low Severity",
      };
  }
}

export function BiasDetector({ detections }: BiasDetectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Hidden Bias (Shortcut) Detector</CardTitle>
        <CardDescription>
          Grad-CAM attention heatmaps highlighting non-anatomical regions with high model attention
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
          {detections.map((detection) => {
            const styles = getSeverityStyles(detection.severity);
            return (
              <div
                key={detection.id}
                className="group relative overflow-hidden rounded-lg border bg-slate-50"
              >
                {/* Image with mock heatmap overlay */}
                <div className="relative aspect-square">
                  <img
                    src={detection.imageUrl}
                    alt={detection.label}
                    className="h-full w-full object-cover grayscale"
                  />
                  {/* Mock Grad-CAM Heatmap Overlay */}
                  <div className={cn("absolute inset-0", styles.overlay)} />
                  {/* Hotspot indicators */}
                  <div className="absolute left-2 top-2 h-6 w-6 animate-pulse rounded-full bg-red-500/60 blur-sm" />
                  <div className="absolute right-3 top-3 h-4 w-4 animate-pulse rounded-full bg-amber-500/50 blur-sm" />
                  {/* Severity Badge */}
                  <Badge
                    variant="outline"
                    className={cn(
                      "absolute right-2 top-2 gap-1 text-xs",
                      styles.badge
                    )}
                  >
                    {styles.icon}
                    {styles.label}
                  </Badge>
                </div>
                {/* Caption */}
                <div className="p-3">
                  <p className="text-sm font-medium text-foreground">{detection.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {detection.caption}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
