import asyncio
import io
import json
import math
import os
import shutil
import tempfile
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import boto3
import httpx
import numpy as np
import pandas as pd
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from torch.utils.data import DataLoader
from torchvision import transforms

try:
    from worker_ml import (
        ImageDataset,
        analyze_subgroups,
        generate_heatmap_collage,
        train_proxy_model,
        upload_heatmap_to_s3,
    )
except ImportError:
    # Fallback if running in different context
    ImageDataset = None
    analyze_subgroups = None
    generate_heatmap_collage = None
    train_proxy_model = None
    upload_heatmap_to_s3 = None


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


def _find_images_in_directory(directory: Path) -> list[Path]:
    """Recursively find all image files (.jpg, .png, .dicom, .dcm) in directory."""
    image_extensions = {".jpg", ".jpeg", ".png", ".dicom", ".dcm", ".tiff", ".tif"}
    images = []
    for ext in image_extensions:
        images.extend(directory.glob(f"**/*{ext}"))
        images.extend(directory.glob(f"**/*{ext.upper()}"))
    return sorted(images)


def _extract_dataset_archive(archive_path: Path, output_dir: Path) -> tuple[list[Path], Path]:
    """
    Extract a ZIP file and return (list of image paths, metadata CSV path or None).
    """
    if archive_path.suffix.lower() == ".zip":
        with zipfile.ZipFile(archive_path, "r") as zf:
            zf.extractall(output_dir)
    else:
        raise ValueError(f"Unsupported archive format: {archive_path.suffix}")

    # Find images
    images = _find_images_in_directory(output_dir)

    # Look for metadata CSV
    metadata_csv = None
    for csv_file in output_dir.glob("**/*.csv"):
        if "metadata" in csv_file.name.lower() or "labels" in csv_file.name.lower():
            metadata_csv = csv_file
            break

    return images, metadata_csv


def _build_image_label_mapping(
    image_paths: list[Path], metadata_df: pd.DataFrame = None
) -> tuple[dict[str, int], list[int]]:
    """
    Map image filenames to binary labels.
    If metadata_df provided, use 'label' column.
    Otherwise, infer from directory structure (subfolders as labels).
    """
    image_to_label = {}
    labels = []

    if metadata_df is not None and "label" in metadata_df.columns:
        # Use metadata CSV labels
        for idx, row in metadata_df.iterrows():
            filename = str(row.get("filename", ""))
            label_val = row.get("label", 0)
            label_int = 1 if str(label_val).lower() in {"positive", "diseased", "sick", "1", "true"} else 0

            # Match image files
            for img_path in image_paths:
                if filename in img_path.name or img_path.name in filename:
                    image_to_label[str(img_path)] = label_int
                    labels.append(label_int)
                    break
    else:
        # Infer from folder structure
        for img_path in image_paths:
            parent_name = img_path.parent.name.lower()
            label_int = 1 if any(x in parent_name for x in {"positive", "diseased", "sick", "abnormal"}) else 0
            image_to_label[str(img_path)] = label_int
            labels.append(label_int)

    # If no labels found, assume balanced
    if not labels:
        labels = [i % 2 for i in range(len(image_paths))]

    return image_to_label, labels


def _generate_explanation(model_acc: float, fairness_score: float, subgroup_results: dict, disparity_detected: bool) -> str:
    """Generate human-readable explanation of bias analysis results."""
    explanation = ""

    # Overall accuracy statement
    if model_acc > 85:
        explanation += f"The proxy model achieved {model_acc:.1f}% accuracy on the dataset, indicating good overall predictability. "
    elif model_acc > 70:
        explanation += f"The proxy model achieved {model_acc:.1f}% accuracy, showing moderate predictability with some challenges. "
    else:
        explanation += f"The proxy model achieved {model_acc:.1f}% accuracy, which is below acceptable thresholds and may indicate significant dataset or label quality issues. "

    # Fairness comment
    if fairness_score > 80:
        explanation += "Class distribution is well-balanced. "
    elif fairness_score > 60:
        explanation += "Class distribution shows some imbalance that may affect model performance. "
    else:
        explanation += "Class distribution is severely imbalanced, which will likely bias the model. "

    # Subgroup disparity
    if disparity_detected and subgroup_results.get("disparity_percent", 0) > 0:
        disparity = subgroup_results.get("disparity_percent", 0)
        explanation += f"Significant performance disparities detected across demographic groups ({disparity:.1f}% variance), suggesting potential shortcut learning or dataset biases. "
    else:
        explanation += "Performance is relatively consistent across demographic groups. "

    # Recommendations
    explanation += "\nRecommendations:\n"
    if model_acc < 75:
        explanation += "- Review dataset for label quality and consistency\n"
    if fairness_score < 70:
        explanation += "- Balance class distribution through stratified sampling or reweighting\n"
    if disparity_detected:
        explanation += "- Augment underrepresented subgroups with realistic synthetic data\n"
        explanation += "- Apply fairness-aware training constraints (e.g., adversarial debiasing)\n"
    explanation += "- Validate findings with domain experts before training final model\n"

    return explanation


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
    """
    Main analysis job orchestrator.
    Handles both tabular (CSV/Parquet) and image (ZIP) datasets.
    Performs statistical analysis, proxy model training, Grad-CAM generation, and subgroup analysis.
    """
    callback_url = payload.callback_url or os.getenv("BACKEND_CALLBACK_URL")
    if not callback_url:
        raise RuntimeError("Missing callback URL in payload and BACKEND_CALLBACK_URL env var")

    try:
        with tempfile.TemporaryDirectory(prefix="biaslens-colab-") as tmp:
            tmp_dir = Path(tmp)

            await _emit_progress(callback_url, payload.job_id, 10, "Downloading dataset from storage")
            dataset_path = _download_dataset(payload.s3_object_uri, tmp_dir)

            # Determine if tabular or image dataset
            is_image_dataset = dataset_path.suffix.lower() == ".zip"

            if is_image_dataset:
                await _run_image_analysis(payload, callback_url, dataset_path, tmp_dir)
            else:
                await _run_tabular_analysis(payload, callback_url, dataset_path)

    except Exception as exc:
        print(f"Analysis job failed: {exc}")
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


async def _run_tabular_analysis(payload: TriggerPayload, callback_url: str, dataset_path: Path) -> None:
    """Analyze tabular dataset (CSV, Parquet, JSON)."""
    await _emit_progress(callback_url, payload.job_id, 30, "Loading tabular dataset")
    df = _load_table(dataset_path)

    await _emit_progress(callback_url, payload.job_id, 60, "Running statistical analysis")
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


async def _run_image_analysis(payload: TriggerPayload, callback_url: str, archive_path: Path, tmp_dir: Path) -> None:
    """
    Analyze image dataset with PyTorch proxy model, Grad-CAM, and subgroup analysis.
    """
    if train_proxy_model is None:
        raise RuntimeError("PyTorch ML modules not available. Install torch, torchvision, opencv-python.")

    await _emit_progress(callback_url, payload.job_id, 20, "Extracting image archive")
    image_paths, metadata_csv = _extract_dataset_archive(archive_path, tmp_dir)

    if not image_paths:
        raise ValueError("No images found in archive")

    await _emit_progress(callback_url, payload.job_id, 30, f"Found {len(image_paths)} images, creating dataset")

    # Load metadata if available
    metadata_df = None
    if metadata_csv and metadata_csv.exists():
        metadata_df = pd.read_csv(metadata_csv)

    # Build label mappings
    image_to_label, labels = _build_image_label_mapping(image_paths, metadata_df)

    # Convert to PyTorch Dataset
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    image_paths_str = [str(p) for p in image_paths]
    dataset = ImageDataset(image_paths_str, labels, transform=transform)

    # Split into train/val
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = torch.utils.data.random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False, num_workers=0)

    await _emit_progress(callback_url, payload.job_id, 40, "Training EfficientNet-B0 proxy model (this may take 5-10 min)")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    model, train_metrics = train_proxy_model(train_loader, val_loader, epochs=5, device=device)

    await _emit_progress(callback_url, payload.job_id, 65, "Generating Grad-CAM heatmaps")
    heatmap_bytes = generate_heatmap_collage(image_paths_str, model, num_samples=6, device=device)

    await _emit_progress(callback_url, payload.job_id, 75, "Uploading heatmaps to S3")
    heatmap_s3_uri = _upload_heatmaps_to_s3(payload.job_id, heatmap_bytes)

    await _emit_progress(callback_url, payload.job_id, 85, "Analyzing demographic subgroups")
    subgroup_results = {}
    if metadata_df is not None:
        subgroup_results = analyze_subgroups(
            metadata_df, image_paths_str, model, image_to_label, device=device
        )

    # Compute overall metrics
    model_accuracy = float(train_metrics.get("validation_accuracy", 0))
    class_counts = Counter(labels)
    fairness_score = _compute_fairness_score(class_counts)
    disparity_detected = subgroup_results.get("disparity_detected", False)

    # Generate explanations
    explanation = _generate_explanation(model_accuracy, fairness_score, subgroup_results, disparity_detected)

    # Build results
    results = {
        "dataset_type": "image",
        "total_images": len(image_paths),
        "model_accuracy": model_accuracy,
        "validation_accuracy": model_accuracy,
        "fairness_score": fairness_score,
        "class_distribution": [
            {"label": str(k), "count": int(v), "percentage": _safe_percent(float(v), float(len(labels)))}
            for k, v in class_counts.items()
        ],
        "subgroup_analysis": subgroup_results,
        "heatmap_url": heatmap_s3_uri,
        "explanation": explanation,
        "bias_risk": _assess_bias_risk(model_accuracy, fairness_score, disparity_detected),
        "warnings": _build_warnings_from_ml_results(model_accuracy, fairness_score, disparity_detected),
    }

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


def _upload_heatmaps_to_s3(job_id: str, heatmap_bytes: bytes) -> str:
    """Upload heatmap collage to S3 and return URI."""
    bucket = os.getenv("S3_BUCKET_NAME")
    if not bucket:
        print("Warning: S3_BUCKET_NAME not set, returning placeholder URL")
        return f"s3://placeholder/heatmaps/{job_id}.png"

    key = f"heatmaps/{job_id}/gradcam_collage.png"

    try:
        s3_uri = upload_heatmap_to_s3(
            heatmap_bytes,
            bucket,
            key,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            aws_session_token=os.getenv("AWS_SESSION_TOKEN"),
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )
        return s3_uri
    except Exception as e:
        print(f"Warning: Failed to upload heatmaps to S3: {e}")
        return f"s3://error/{job_id}.png"


def _compute_fairness_score(class_counts: Counter) -> float:
    """Compute fairness score based on class balance."""
    if not class_counts:
        return 50.0

    counts = list(class_counts.values())
    min_count = max(min(counts), 1)
    max_count = max(counts)
    imbalance_ratio = max_count / min_count

    # Fairness decreases with imbalance
    return float(round(max(0.0, 100.0 - (imbalance_ratio - 1.0) * 18.0), 2))


def _assess_bias_risk(model_accuracy: float, fairness_score: float, disparity_detected: bool) -> str:
    """Assess overall bias risk from ML metrics."""
    if model_accuracy < 60 or fairness_score < 50 or disparity_detected:
        return "high"
    elif model_accuracy < 75 or fairness_score < 70:
        return "medium"
    return "low"


def _build_warnings_from_ml_results(model_accuracy: float, fairness_score: float, disparity_detected: bool) -> list[dict[str, str]]:
    """Build warning messages from ML analysis results."""
    warnings = []

    if model_accuracy < 70:
        warnings.append({
            "type": "model_performance",
            "severity": "critical",
            "message": f"Model accuracy ({model_accuracy:.1f}%) is below acceptable threshold. Check dataset quality and labels."
        })

    if fairness_score < 65:
        warnings.append({
            "type": "class_imbalance",
            "severity": "warning",
            "message": "Class imbalance detected. Model may be biased toward majority class."
        })

    if disparity_detected:
        warnings.append({
            "type": "hidden_bias",
            "severity": "critical",
            "message": "Subgroup performance disparities detected. Model may learn shortcuts or demographic-specific patterns."
        })

    return warnings


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
