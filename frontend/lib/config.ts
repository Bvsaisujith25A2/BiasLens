/**
 * Application configuration with environment variable support and local-dev fallbacks.
 */

function getOptionalEnvVar(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, "");
}

// Lazy initialization to avoid throwing during build time
let _apiBaseUrl: string | null = null;

export function getApiBaseUrl(): string {
  if (_apiBaseUrl === null) {
    const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

    if (configuredBaseUrl) {
      _apiBaseUrl = normalizeBaseUrl(configuredBaseUrl);
      return _apiBaseUrl;
    }

    // Local development fallback: frontend runs on 3000, backend on 8000.
    if (process.env.NODE_ENV !== "production") {
      _apiBaseUrl = "http://127.0.0.1:8000";
      return _apiBaseUrl;
    }

    const errorMessage = `[BiasLens Config Error] Missing required environment variable: NEXT_PUBLIC_API_BASE_URL. 
Please ensure this variable is set in your .env.local file or Vercel dashboard.
Example: NEXT_PUBLIC_API_BASE_URL=https://your-api-server.com`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  return _apiBaseUrl;
}

export const config = {
  get apiBaseUrl() {
    return getApiBaseUrl();
  },
  polling: {
    interval: parseInt(getOptionalEnvVar("NEXT_PUBLIC_POLLING_INTERVAL", "5000"), 10),
    maxAttempts: parseInt(getOptionalEnvVar("NEXT_PUBLIC_POLLING_MAX_ATTEMPTS", "120"), 10),
  },
  upload: {
    maxFileSizeMB: parseInt(getOptionalEnvVar("NEXT_PUBLIC_MAX_FILE_SIZE_MB", "500"), 10),
    allowedTypes: ["image/jpeg", "image/png", "application/dicom", "text/csv", "application/csv"],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".dcm", ".dicom", ".csv"],
  },
} as const;

export type Config = typeof config;
