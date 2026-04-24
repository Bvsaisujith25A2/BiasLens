import asyncio
import json
import math
import os
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import boto3
import httpx
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


class AnalysisOptions(BaseModel):
    check_class_imbalance: bool = True
    check_source_variability: bool = True
    detect_hidden_bias: bool = True


class TriggerPayload(BaseModel):
    job_id: str
    s3_object_uri: str
    dataset_name: str | None = None
    analysis_options: AnalysisOptions = Field(default_factory=AnalysisOptions)
    callback_url: str | None = None


app = FastAPI(title="BiasLens Colab Worker", version="0.1.0")


def _parse_s3_uri(s3_uri: str) -> tuple[str, str]:
    parsed = urlparse(s3_uri)
    if parsed.scheme != "s3" or not parsed.netloc:
        raise ValueError(f"Invalid S3 URI: {s3_uri}")
    return parsed.netloc, parsed.path.lstrip("/")


def _download_dataset(uri: str, output_dir: Path) -> Path:
    parsed = urlparse(uri)

    if parsed.scheme == "s3":
        bucket, key = _parse_s3_uri(uri)
        filename = Path(key).name or "dataset.csv"
        out_path = output_dir / filename

        session_kwargs: dict[str, Any] = {}
        if os.getenv("AWS_REGION"):
            session_kwargs["region_name"] = os.getenv("AWS_REGION")

        if os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY"):
            session_kwargs["aws_access_key_id"] = os.getenv("AWS_ACCESS_KEY_ID")
            session_kwargs["aws_secret_access_key"] = os.getenv("AWS_SECRET_ACCESS_KEY")

        if os.getenv("AWS_SESSION_TOKEN"):
            session_kwargs["aws_session_token"] = os.getenv("AWS_SESSION_TOKEN")

        s3 = boto3.client("s3", **session_kwargs)
        s3.download_file(bucket, key, str(out_path))
        return out_path

    if parsed.scheme in {"http", "https"}:
        filename = Path(parsed.path).name or "dataset.csv"
        out_path = output_dir / filename
        with httpx.stream("GET", uri, timeout=120) as response:
            response.raise_for_status()
            with out_path.open("wb") as f:
                for chunk in response.iter_bytes():
                    f.write(chunk)
        return out_path

    raise ValueError(f"Unsupported dataset URI scheme: {parsed.scheme}")


def _load_table(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix in {".csv", ".txt"}:
        return pd.read_csv(path)
    if suffix in {".parquet"}:
        return pd.read_parquet(path)
    if suffix in {".json", ".jsonl"}:
        return pd.read_json(path, lines=suffix == ".jsonl")
    raise ValueError(f"Unsupported dataset format: {suffix}. Use CSV, Parquet, JSON, or JSONL")


def _pick_label_column(df: pd.DataFrame) -> str:
    preferred = ["label", "target", "class", "outcome", "y"]
    lower_map = {str(col).lower(): col for col in df.columns}

    for key in preferred:
        if key in lower_map:
            return str(lower_map[key])

    categorical_cols = [
        col for col in df.columns if pd.api.types.is_object_dtype(df[col]) or pd.api.types.is_bool_dtype(df[col])
    ]
    if categorical_cols:
        return str(categorical_cols[0])

    return str(df.columns[-1])


def _pick_source_column(df: pd.DataFrame) -> str | None:
    preferred = ["source", "site", "hospital", "domain", "scanner", "institution"]
    lower_map = {str(col).lower(): col for col in df.columns}

    for key in preferred:
        if key in lower_map:
            return str(lower_map[key])

    candidates: list[str] = []
    for col in df.columns:
        series = df[col]
        if pd.api.types.is_object_dtype(series) or pd.api.types.is_categorical_dtype(series):
            nunique = int(series.nunique(dropna=True))
            if 2 <= nunique <= 25:
                candidates.append(str(col))

    return candidates[0] if candidates else None


def _safe_percent(value: float, total: float) -> float:
    if total <= 0:
        return 0.0
    return float(round((value / total) * 100, 2))


def _compute_entropy_percent(counts: list[int]) -> float:
    total = float(sum(counts))
    if total <= 0 or len(counts) <= 1:
        return 0.0

    probs = [c / total for c in counts if c > 0]
    entropy = -sum(p * math.log(p, 2) for p in probs)
    max_entropy = math.log(len(counts), 2)
    if max_entropy <= 0:
        return 0.0
    return float(round((entropy / max_entropy) * 100, 2))


def _build_results(df: pd.DataFrame, options: AnalysisOptions) -> dict[str, Any]:
    total_samples = int(len(df))
    analyzed_samples = total_samples

    label_col = _pick_label_column(df)
    label_counts = Counter(df[label_col].fillna("unknown").astype(str).tolist())

    class_imbalance: list[dict[str, Any]] = []
    for name, count in label_counts.items():
        class_imbalance.append(
            {
                "name": name,
                "value": int(count),
                "percentage": _safe_percent(float(count), float(total_samples)),
            }
        )

    counts_only = [item["value"] for item in class_imbalance] or [0]
    min_count = max(min(counts_only), 1)
    max_count = max(counts_only)
    imbalance_ratio = max_count / min_count
    fairness_score = float(round(max(0.0, 100.0 - (imbalance_ratio - 1.0) * 18.0), 2))

    source_col = _pick_source_column(df)
    source_variability: list[dict[str, Any]] = []
    diversity_score = 0.0
    if source_col and options.check_source_variability:
        source_counts = Counter(df[source_col].fillna("unknown").astype(str).tolist())
        for src, count in source_counts.items():
            source_variability.append(
                {
                    "source": src,
                    "count": int(count),
                    "percentage": _safe_percent(float(count), float(total_samples)),
                }
            )
        diversity_score = _compute_entropy_percent([item["count"] for item in source_variability])
    else:
        diversity_score = 50.0

    warnings: list[dict[str, Any]] = []
    if fairness_score < 65:
        warnings.append(
            {
                "type": "class_imbalance",
                "severity": "warning",
                "message": f"Class imbalance detected (ratio {imbalance_ratio:.2f}:1).",
            }
        )

    if diversity_score < 50:
        warnings.append(
            {
                "type": "source_variability",
                "severity": "warning",
                "message": "Low source diversity may hurt generalization.",
            }
        )

    bias_detections: list[dict[str, Any]] = []
    if options.detect_hidden_bias and source_col:
        crosstab = pd.crosstab(df[source_col].fillna("unknown"), df[label_col].fillna("unknown"), normalize="index")
        flagged = 0
        for src in crosstab.index:
            dominant = float(crosstab.loc[src].max())
            if dominant >= 0.8 and flagged < 5:
                bias_detections.append(
                    {
                        "id": f"det-{flagged + 1}",
                        "image_url": "/placeholder.svg?height=200&width=200",
                        "label": f"Source {src}",
                        "caption": f"{dominant * 100:.1f}% of this source maps to one label; possible shortcut correlation.",
                        "severity": "high" if dominant >= 0.9 else "medium",
                        "confidence": min(0.99, round(dominant, 2)),
                    }
                )
                flagged += 1

        if bias_detections:
            warnings.append(
                {
                    "type": "hidden_bias",
                    "severity": "critical",
                    "message": "Potential shortcut learning patterns detected in source-label relationships.",
                }
            )

    bias_risk = "low"
    if fairness_score < 60 or diversity_score < 50 or any(w["severity"] == "critical" for w in warnings):
        bias_risk = "high"
    elif fairness_score < 75 or diversity_score < 70 or warnings:
        bias_risk = "medium"

    return {
        "fairness_score": fairness_score,
        "diversity_score": float(round(diversity_score, 2)),
        "total_samples": total_samples,
        "analyzed_samples": analyzed_samples,
        "class_imbalance": class_imbalance if options.check_class_imbalance else [],
        "source_variability": source_variability if options.check_source_variability else [],
        "bias_detections": bias_detections if options.detect_hidden_bias else [],
        "warnings": warnings,
        "bias_risk": bias_risk,
    }


async def _post_callback(callback_url: str, payload: dict[str, Any]) -> None:
    headers = {"Content-Type": "application/json"}
    shared_secret = os.getenv("COLAB_SHARED_SECRET")
    if shared_secret:
        headers["X-Worker-Secret"] = shared_secret

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(callback_url, json=payload, headers=headers)
        response.raise_for_status()


async def _emit_progress(callback_url: str, job_id: str, progress: int, step: str) -> None:
    await _post_callback(
        callback_url,
        {
            "job_id": job_id,
            "status": "PROCESSING",
            "progress": progress,
            "current_step": step,
        },
    )


async def _run_analysis_job(payload: TriggerPayload) -> None:
    callback_url = payload.callback_url or os.getenv("BACKEND_CALLBACK_URL")
    if not callback_url:
        raise RuntimeError("Missing callback URL in payload and BACKEND_CALLBACK_URL env var")

    try:
        await _emit_progress(callback_url, payload.job_id, 15, "Downloading dataset from storage")

        with tempfile.TemporaryDirectory(prefix="biaslens-colab-") as tmp:
            tmp_dir = Path(tmp)
            dataset_path = _download_dataset(payload.s3_object_uri, tmp_dir)

            await _emit_progress(callback_url, payload.job_id, 40, "Loading dataset")
            df = _load_table(dataset_path)

            await _emit_progress(callback_url, payload.job_id, 70, "Running bias checks")
            results = _build_results(df, payload.analysis_options)

        await _post_callback(
            callback_url,
            {
                "job_id": payload.job_id,
                "status": "COMPLETED",
                "progress": 100,
                "current_step": "Analysis complete",
                "results": results,
            },
        )
    except Exception as exc:
        await _post_callback(
            callback_url,
            {
                "job_id": payload.job_id,
                "status": "FAILED",
                "progress": 100,
                "current_step": "Worker failed",
                "error_message": str(exc),
            },
        )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "colab-worker"}


@app.post("/run-analysis")
async def run_analysis(payload: TriggerPayload) -> dict[str, Any]:
    if not payload.job_id:
        raise HTTPException(status_code=400, detail="job_id is required")

    asyncio.create_task(_run_analysis_job(payload))
    return {"accepted": True, "job_id": payload.job_id}


def start_worker() -> Any:
    import uvicorn

    host = os.getenv("COLAB_WORKER_HOST", "0.0.0.0")
    port = int(os.getenv("COLAB_WORKER_PORT", "8787"))

    config = uvicorn.Config(app=app, host=host, port=port, reload=False)
    server = uvicorn.Server(config=config)

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # Normal Python process (no running event loop).
        server.run()
        return None

    # Jupyter/Colab already has an active event loop.
    task = loop.create_task(server.serve())
    print(f"BiasLens Colab worker running at http://{host}:{port}")
    return task


if __name__ == "__main__":
    start_worker()
