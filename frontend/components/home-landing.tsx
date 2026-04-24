"use client";

import Link from "next/link";
import { Shield, BarChart3, AlertTriangle, Search, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: BarChart3,
    title: "Comprehensive Bias Analysis",
    description: "Detect class imbalance, source variability, and hidden confounders in your medical imaging datasets.",
  },
  {
    icon: AlertTriangle,
    title: "Real-time Warnings",
    description: "Get immediate alerts when potential biases are detected, with actionable recommendations.",
  },
  {
    icon: Search,
    title: "Hidden Bias Detection",
    description: "Use Grad-CAM heatmaps to identify where your model might be learning spurious correlations.",
  },
  {
    icon: Shield,
    title: "Fairness Scoring",
    description: "Quantitative metrics for fairness and diversity to ensure equitable AI model training.",
  },
];

const benefits = [
  "Prevent biased AI models before they reach production",
  "Ensure regulatory compliance with healthcare AI standards",
  "Improve model generalization across diverse populations",
  "Reduce costly model retraining cycles",
];

export function HomeLanding() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-background to-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-20 lg:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs sm:mb-6 sm:px-4 sm:py-1.5 sm:text-sm">
              <span className="flex h-2 w-2 rounded-full bg-green-500" />
              Pre-training bias detection for healthcare AI
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
              Audit Your Medical Datasets{" "}
              <span className="text-primary">Before Training</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
              BiasLens helps AI/ML engineers and healthcare researchers identify and mitigate
              biases in medical imaging datasets before they propagate into production models.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row sm:gap-4">
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full gap-2 sm:w-auto">
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Everything you need to audit your datasets
            </h2>
            <p className="mt-3 text-base text-muted-foreground sm:mt-4 sm:text-lg">
              Comprehensive tools for identifying and addressing bias in medical imaging data.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:mt-16 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card key={feature.title} className="border-2 transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="border-t bg-muted/30 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                Why bias detection matters
              </h2>
              <p className="mt-3 text-base text-muted-foreground sm:mt-4 sm:text-lg">
                Models trained on biased data perpetuate and amplify healthcare disparities.
                BiasLens helps you build AI that works for everyone.
              </p>
              <ul className="mt-8 space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10">
                <Link href="/register">
                  <Button size="lg" className="gap-2">
                    Start Auditing Today
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Fairness Score</span>
                  <span className="text-2xl font-bold text-amber-600">62/100</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[62%] rounded-full bg-amber-500" />
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Warning: Class Imbalance Detected
                  </p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    67% of samples are labeled &quot;Healthy&quot; while only 33% are &quot;Diseased&quot;
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-2xl font-bold">12,450</p>
                    <p className="text-xs text-muted-foreground">Total Samples</p>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-2xl font-bold text-destructive">3</p>
                    <p className="text-xs text-muted-foreground">Bias Warnings</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            Ready to eliminate bias from your AI?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground sm:mt-4 sm:text-lg">
            Join healthcare researchers and AI engineers using BiasLens to build fairer,
            more equitable medical AI systems.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row sm:gap-4">
            <Link href="/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full gap-2 sm:w-auto">
                Create Free Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
