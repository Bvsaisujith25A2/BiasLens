import type {
  UploadedFile,
  BiasMetrics,
  ClassImbalanceData,
  SourceVariabilityData,
  BiasDetection,
} from "./types";

export const mockUploadedFiles: UploadedFile[] = [
  {
    id: "1",
    name: "chest_xray_batch_001.zip",
    size: 245000000,
    type: "application/zip",
    status: "verified",
    statusMessage: "MD5 Hash Verified",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: "2",
    name: "patient_metadata.csv",
    size: 1200000,
    type: "text/csv",
    status: "verified",
    statusMessage: "Schema Validated",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 3),
  },
  {
    id: "3",
    name: "pneumonia_labels.json",
    size: 450000,
    type: "application/json",
    status: "checking",
    statusMessage: "Checking for duplicates...",
    uploadedAt: new Date(Date.now() - 1000 * 60 * 1),
  },
  {
    id: "4",
    name: "ct_scan_series_042.dcm",
    size: 89000000,
    type: "application/dicom",
    status: "validating",
    statusMessage: "Validating DICOM headers...",
    uploadedAt: new Date(Date.now() - 1000 * 30),
  },
];

export const mockBiasMetrics: BiasMetrics = {
  fairnessScore: 62,
  diversityScore: 74,
  totalSamples: 45892,
  analyzedSamples: 45892,
};

export const mockClassImbalanceData: ClassImbalanceData[] = [
  { name: "Healthy", value: 32145, fill: "var(--color-chart-2)" },
  { name: "Diseased", value: 13747, fill: "var(--color-chart-1)" },
];

export const mockSourceVariabilityData: SourceVariabilityData[] = [
  { source: "Hospital A", count: 15234 },
  { source: "Hospital B", count: 12456 },
  { source: "Hospital C", count: 8923 },
  { source: "Hospital D", count: 5672 },
  { source: "Hospital E", count: 3607 },
];

export const mockBiasDetections: BiasDetection[] = [
  {
    id: "1",
    imageUrl: "/placeholder.svg?height=200&width=200",
    label: "X-Ray Sample #4521",
    caption: "High gradient intensity in corner region - possible hospital watermark interference",
    severity: "high",
  },
  {
    id: "2",
    imageUrl: "/placeholder.svg?height=200&width=200",
    label: "X-Ray Sample #7823",
    caption: "Consistent artifact in upper-left quadrant across Hospital B samples",
    severity: "high",
  },
  {
    id: "3",
    imageUrl: "/placeholder.svg?height=200&width=200",
    label: "CT Scan #1247",
    caption: "Scanner-specific noise pattern detected in peripheral areas",
    severity: "medium",
  },
  {
    id: "4",
    imageUrl: "/placeholder.svg?height=200&width=200",
    label: "X-Ray Sample #9102",
    caption: "Text overlay region showing elevated attention scores",
    severity: "medium",
  },
  {
    id: "5",
    imageUrl: "/placeholder.svg?height=200&width=200",
    label: "MRI Slice #3341",
    caption: "Edge artifacts correlating with specific manufacturer",
    severity: "low",
  },
  {
    id: "6",
    imageUrl: "/placeholder.svg?height=200&width=200",
    label: "X-Ray Sample #5567",
    caption: "Positioning marker detected as feature by attention mechanism",
    severity: "high",
  },
];
