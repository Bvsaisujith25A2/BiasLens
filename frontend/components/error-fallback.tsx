"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, WifiOff, ServerOff, ShieldOff } from "lucide-react";
import type { FallbackProps } from "react-error-boundary";

interface ErrorFallbackProps extends FallbackProps {
  title?: string;
}

function getErrorDetails(error: Error | null) {
  const message = error?.message || "";
  
  // Network/connection errors
  if (message.includes("Unable to connect") || message.includes("network") || message.includes("fetch")) {
    return {
      icon: WifiOff,
      title: "Connection Error",
      description: "Unable to connect to the server. Please check your internet connection.",
      suggestion: "Make sure you're connected to the internet and try again.",
    };
  }
  
  // CORS errors
  if (message.includes("CORS") || message.includes("security policy")) {
    return {
      icon: ShieldOff,
      title: "Security Error",
      description: "The request was blocked by security policy.",
      suggestion: "This is typically a configuration issue. Please contact support.",
    };
  }
  
  // Server errors
  if (message.includes("Server error") || message.includes("500")) {
    return {
      icon: ServerOff,
      title: "Server Error",
      description: "The server encountered an error processing your request.",
      suggestion: "Please try again in a few moments. If the problem persists, contact support.",
    };
  }
  
  // Environment variable missing
  if (message.includes("NEXT_PUBLIC_API_BASE_URL") || message.includes("environment variable")) {
    return {
      icon: AlertCircle,
      title: "Configuration Error",
      description: "The application is not properly configured.",
      suggestion: "Please ensure all required environment variables are set.",
    };
  }
  
  // Default error
  return {
    icon: AlertCircle,
    title: "Something went wrong",
    description: "An unexpected error occurred while loading this section.",
    suggestion: "Please try again or contact support if the issue persists.",
  };
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
  title,
}: ErrorFallbackProps) {
  const errorDetails = getErrorDetails(error);
  const Icon = errorDetails.icon;
  
  return (
    <Card className="mx-auto max-w-md border-destructive/20 bg-destructive/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Icon className="h-5 w-5" />
          {title || errorDetails.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {errorDetails.description}
        </p>
        <p className="text-sm text-muted-foreground">
          {errorDetails.suggestion}
        </p>
        {process.env.NODE_ENV === "development" && error?.message && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Technical details
            </summary>
            <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-muted-foreground">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        <Button onClick={resetErrorBoundary} className="w-full gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}
