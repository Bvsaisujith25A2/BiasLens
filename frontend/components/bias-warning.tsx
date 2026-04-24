"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BiasWarning() {
  return (
    <Alert className="border-amber-300 bg-amber-50">
      <AlertTriangle className="h-5 w-5 text-amber-600" />
      <AlertTitle className="text-amber-800">Critical Bias Pattern Detected</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-amber-700">
          <strong>Warning:</strong> 80% of pneumonia labels are associated with a specific 
          hospital marker; the model may be learning the marker instead of pathology. This 
          correlation suggests a potential shortcut learning pattern that could severely 
          impact model generalization.
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" className="border-amber-300 bg-white text-amber-700 hover:bg-amber-100">
            View Detailed Report
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" className="border-amber-300 bg-white text-amber-700 hover:bg-amber-100">
            Suggested Mitigations
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
