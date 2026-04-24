"use client";

import useSWR from "swr";
import { api, AnalysisHistoryResponse } from "@/lib/api";
import { Analysis, mapApiAnalysisToAnalysis } from "@/lib/types";

interface UseAnalysisHistoryOptions {
  page?: number;
  perPage?: number;
}

interface UseAnalysisHistoryReturn {
  analyses: Analysis[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

async function fetchAnalysisHistory(
  page: number,
  perPage: number
): Promise<{ analyses: Analysis[]; total: number }> {
  try {
    const response = await api.getAnalysisHistory(page, perPage);
    return {
      analyses: response.analyses.map(mapApiAnalysisToAnalysis),
      total: response.total,
    };
  } catch (error) {
    // Return empty data on error - let the component handle display
    throw error;
  }
}

export function useAnalysisHistory(
  options: UseAnalysisHistoryOptions = {}
): UseAnalysisHistoryReturn {
  const { page = 1, perPage = 10 } = options;

  const { data, error, isLoading, mutate } = useSWR(
    ["analysis-history", page, perPage],
    () => fetchAnalysisHistory(page, perPage),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      errorRetryCount: 2,
    }
  );

  return {
    analyses: data?.analyses || [],
    total: data?.total || 0,
    isLoading,
    error: error || null,
    mutate,
  };
}

// Mock data fallback for demo/development
export function useMockAnalysisHistory(): UseAnalysisHistoryReturn {
  const mockAnalyses: Analysis[] = [
    {
      id: "1",
      name: "Chest X-Ray Pneumonia Detection",
      datasetName: "NIH ChestX-ray14",
      status: "completed",
      fairnessScore: 62,
      diversityScore: 74,
      totalSamples: 112120,
      biasWarnings: 3,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
    },
    {
      id: "2",
      name: "Skin Lesion Classification",
      datasetName: "ISIC 2019",
      status: "processing",
      fairnessScore: 0,
      diversityScore: 0,
      totalSamples: 25331,
      biasWarnings: 0,
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    },
    {
      id: "3",
      name: "Diabetic Retinopathy",
      datasetName: "EyePACS",
      status: "completed",
      fairnessScore: 78,
      diversityScore: 82,
      totalSamples: 88702,
      biasWarnings: 1,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
    },
    {
      id: "4",
      name: "Brain MRI Tumor Detection",
      datasetName: "BraTS 2021",
      status: "failed",
      fairnessScore: 0,
      diversityScore: 0,
      totalSamples: 2000,
      biasWarnings: 0,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      id: "5",
      name: "Mammography Screening",
      datasetName: "CBIS-DDSM",
      status: "completed",
      fairnessScore: 71,
      diversityScore: 65,
      totalSamples: 10239,
      biasWarnings: 2,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 3600000),
    },
  ];

  return {
    analyses: mockAnalyses,
    total: mockAnalyses.length,
    isLoading: false,
    error: null,
    mutate: () => {},
  };
}
