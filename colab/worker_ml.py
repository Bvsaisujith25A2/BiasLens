"""
Heavy-lifting ML module for BiasLens Colab Worker.
Handles PyTorch model training, Grad-CAM generation, and subgroup analysis.
Designed for GPU-accelerated Colab environments.
"""

import io
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.transforms as transforms
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision.models import efficientnet_b0

import boto3


class ImageDataset(Dataset):
    """PyTorch Dataset for medical images with binary classification labels."""

    def __init__(self, image_paths: list[str], labels: list[int], transform=None):
        self.image_paths = image_paths
        self.labels = labels
        self.transform = transform

    def __len__(self) -> int:
        return len(self.image_paths)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, int]:
        img_path = self.image_paths[idx]
        label = self.labels[idx]

        try:
            img = Image.open(img_path).convert("RGB")
            if self.transform:
                img = self.transform(img)
            return img, label
        except Exception as e:
            # Return black image on load failure (graceful degradation)
            print(f"Warning: Failed to load {img_path}: {e}")
            black = Image.new("RGB", (224, 224))
            if self.transform:
                black = self.transform(black)
            return black, label


class GradCAMGenerator:
    """Generates Grad-CAM heatmaps for identifying shortcut patterns in images."""

    def __init__(self, model: nn.Module, target_layer: str = "features.8"):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        self._register_hooks()

    def _register_hooks(self):
        """Register forward and backward hooks to capture activations and gradients."""
        def forward_hook(module, input, output):
            self.activations = output.detach()

        def backward_hook(module, grad_input, grad_output):
            self.gradients = grad_output[0].detach()

        # Get the target layer
        target = dict(self.model.named_modules())[self.target_layer]
        target.register_forward_hook(forward_hook)
        target.register_backward_hook(backward_hook)

    def generate(self, image_tensor: torch.Tensor, class_idx: int = None) -> np.ndarray:
        """
        Generate Grad-CAM heatmap for an image.
        Returns a heatmap (0-255) of the same spatial size as input.
        """
        self.model.eval()
        image_tensor = image_tensor.unsqueeze(0)

        with torch.enable_grad():
            output = self.model(image_tensor)
            if class_idx is None:
                class_idx = output.argmax(dim=1).item()

            # Zero gradients
            self.model.zero_grad()

            # Backward pass
            score = output[0, class_idx]
            score.backward()

        # Compute Grad-CAM
        if self.gradients is None or self.activations is None:
            return np.zeros((224, 224), dtype=np.uint8)

        gradients = self.gradients[0].cpu().numpy()
        activations = self.activations[0].cpu().numpy()

        # Compute weights
        weights = np.mean(gradients, axis=(1, 2))
        cam = np.zeros(activations.shape[1:], dtype=np.float32)

        for w, act in zip(weights, activations):
            cam += w * act

        cam = np.maximum(cam, 0)
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
        cam = cv2.resize(cam, (224, 224))
        cam = (cam * 255).astype(np.uint8)

        return cam


def train_proxy_model(
    train_loader: DataLoader,
    val_loader: DataLoader,
    epochs: int = 5,
    device: str = "cuda" if torch.cuda.is_available() else "cpu",
) -> tuple[nn.Module, dict[str, float]]:
    """
    Train EfficientNet-B0 proxy model for bias detection.
    Returns trained model and validation metrics.
    """
    model = efficientnet_b0(weights="DEFAULT")
    model.classifier[1] = nn.Linear(1280, 2)  # Binary classification
    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=2)

    best_val_acc = 0.0
    for epoch in range(epochs):
        # Training phase
        model.train()
        train_loss = 0.0
        train_correct = 0
        train_total = 0

        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            train_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            train_total += labels.size(0)
            train_correct += (predicted == labels).sum().item()

        train_acc = 100 * train_correct / train_total

        # Validation phase
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                _, predicted = torch.max(outputs.data, 1)
                val_total += labels.size(0)
                val_correct += (predicted == labels).sum().item()

        val_acc = 100 * val_correct / val_total
        scheduler.step(val_acc)

        print(f"Epoch [{epoch + 1}/{epochs}] Train Loss: {train_loss / len(train_loader):.4f}, "
              f"Train Acc: {train_acc:.2f}%, Val Acc: {val_acc:.2f}%")

        if val_acc > best_val_acc:
            best_val_acc = val_acc

    return model, {"validation_accuracy": best_val_acc, "final_train_accuracy": train_acc}


def analyze_subgroups(
    df: pd.DataFrame,
    image_paths: list[str],
    model: nn.Module,
    image_to_label: dict[str, int],
    demographic_col: str = None,
    device: str = "cuda" if torch.cuda.is_available() else "cpu",
) -> dict[str, Any]:
    """
    Analyze model performance across demographic subgroups (age, gender, source, etc.).
    Detects outcome disparities and fairness issues.
    """
    subgroup_results = {}

    # Default to 'source' if no demographic column specified
    if not demographic_col:
        demographic_col = _pick_source_column(df)
    if not demographic_col:
        return {"subgroups": [], "disparity_detected": False}

    model.eval()
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    subgroup_accuracies = {}
    for subgroup in df[demographic_col].unique():
        mask = df[demographic_col] == subgroup
        subgroup_indices = mask[mask].index.tolist()

        if not subgroup_indices:
            continue

        correct = 0
        total = 0
        for idx in subgroup_indices:
            if idx < len(image_paths):
                img_path = image_paths[idx]
                true_label = image_to_label.get(img_path, 0)

                try:
                    img = Image.open(img_path).convert("RGB")
                    img = transform(img).unsqueeze(0).to(device)

                    with torch.no_grad():
                        output = model(img)
                        pred_label = output.argmax(dim=1).item()

                    if pred_label == true_label:
                        correct += 1
                    total += 1
                except Exception as e:
                    print(f"Error processing image for subgroup analysis: {e}")
                    total += 1

        if total > 0:
            accuracy = 100 * correct / total
            subgroup_accuracies[str(subgroup)] = accuracy

    # Detect disparity
    if subgroup_accuracies:
        max_acc = max(subgroup_accuracies.values())
        min_acc = min(subgroup_accuracies.values())
        disparity = max_acc - min_acc

        subgroup_results = {
            "subgroups": [
                {"name": name, "accuracy": acc, "sample_count": int((df[demographic_col] == name).sum())}
                for name, acc in subgroup_accuracies.items()
            ],
            "max_accuracy": max_acc,
            "min_accuracy": min_acc,
            "disparity_percent": disparity,
            "disparity_detected": disparity > 15,  # >15% disparity is significant
        }
    else:
        subgroup_results = {
            "subgroups": [],
            "max_accuracy": 0,
            "min_accuracy": 0,
            "disparity_percent": 0,
            "disparity_detected": False,
        }

    return subgroup_results


def generate_heatmap_collage(
    image_paths: list[str],
    model: nn.Module,
    num_samples: int = 6,
    device: str = "cuda" if torch.cuda.is_available() else "cpu",
) -> bytes:
    """
    Generate a 2x3 collage of images with Grad-CAM heatmap overlays.
    Returns PNG bytes for S3 upload.
    """
    model.eval()
    gradcam = GradCAMGenerator(model)

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    collage_height = 224 * 2
    collage_width = 224 * 3
    collage = np.ones((collage_height, collage_width, 3), dtype=np.uint8) * 255

    sample_paths = image_paths[:num_samples]

    for idx, img_path in enumerate(sample_paths):
        row = idx // 3
        col = idx % 3
        y_offset = row * 224
        x_offset = col * 224

        try:
            img = Image.open(img_path).convert("RGB")
            img_array = np.array(img.resize((224, 224)))

            # Generate Grad-CAM
            img_tensor = transform(img).to(device)
            heatmap = gradcam.generate(img_tensor)

            # Create overlay (heatmap in red channel)
            overlay = np.zeros_like(img_array)
            overlay[:, :, 0] = heatmap  # Red for high-activity regions
            overlay[:, :, 1:] = img_array[:, :, 1:] * 0.5

            blended = cv2.addWeighted(img_array, 0.6, overlay, 0.4, 0)
            collage[y_offset : y_offset + 224, x_offset : x_offset + 224] = blended
        except Exception as e:
            print(f"Warning: Could not process {img_path} for collage: {e}")

    # Convert to PNG
    collage_img = Image.fromarray(collage)
    png_bytes = io.BytesIO()
    collage_img.save(png_bytes, format="PNG")
    return png_bytes.getvalue()


def upload_heatmap_to_s3(
    heatmap_bytes: bytes,
    bucket: str,
    key: str,
    aws_access_key_id: str = None,
    aws_secret_access_key: str = None,
    aws_session_token: str = None,
    region_name: str = "us-east-1",
) -> str:
    """Upload heatmap collage to S3 and return public URL."""
    session_kwargs = {}
    if aws_access_key_id:
        session_kwargs["aws_access_key_id"] = aws_access_key_id
    if aws_secret_access_key:
        session_kwargs["aws_secret_access_key"] = aws_secret_access_key
    if aws_session_token:
        session_kwargs["aws_session_token"] = aws_session_token

    s3 = boto3.client("s3", region_name=region_name, **session_kwargs)

    s3.put_object(Bucket=bucket, Key=key, Body=heatmap_bytes, ContentType="image/png")

    # Return S3 URI
    return f"s3://{bucket}/{key}"


def _pick_source_column(df: pd.DataFrame) -> str | None:
    """Helper to find the source/domain column in metadata."""
    preferred = ["source", "site", "hospital", "domain", "scanner", "institution"]
    lower_map = {str(col).lower(): col for col in df.columns}

    for key in preferred:
        if key in lower_map:
            return str(lower_map[key])

    return None
