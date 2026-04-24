# BiasLens Colab Worker - Environment Variables Reference

## Overview
The Colab worker uses environment variables for configuration. Load them from `.env` and `.env.local` files using `python-dotenv`.

## File Hierarchy
1. **`.env`** - Default values (safe to commit)
2. **`.env.local`** - User-specific secrets (git-ignored, DO NOT COMMIT)
3. **`.env.example`** - Template with all available variables and descriptions

## Required Variables

### Backend Configuration
These variables configure how the worker communicates with your BiasLens backend.

| Variable | Type | Example | Description |
|----------|------|---------|-------------|
| `BACKEND_CALLBACK_URL` | URL | `https://api.example.com/api/v1/webhooks/colab/job-status` | Webhook endpoint where worker sends job status updates |
| `BACKEND_HEALTH_URL` | URL | `https://api.example.com/api/v1/health` | Health check endpoint to verify backend is online |
| `COLAB_SHARED_SECRET` | String | `secret-key-12345` | Shared authentication secret for webhook callbacks (must match backend config) |

### AWS S3 Configuration
These variables configure access to your AWS S3 bucket for dataset storage.

| Variable | Type | Example | Description |
|----------|------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | String | `AKIAIOSFODNN7EXAMPLE` | AWS IAM user access key ID |
| `AWS_SECRET_ACCESS_KEY` | String | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` | AWS IAM user secret access key |
| `AWS_REGION` | String | `us-east-1` | AWS region where S3 bucket is located |
| `S3_BUCKET_NAME` | String | `biaslens-datasets` | S3 bucket name for storing datasets and results |
| `AWS_SESSION_TOKEN` | String (optional) | (empty for permanent creds) | Temporary STS session token (leave empty if using permanent IAM credentials) |

### Ngrok Configuration
These variables configure public exposure of the Colab worker.

| Variable | Type | Example | Description |
|----------|------|---------|-------------|
| `NGROK_AUTHTOKEN` | String | `7f...aB1c2D3e4F5g6H7i8J9k` | ngrok authentication token for permanent domain reservation |

## Optional Variables

### Worker Binding
Control how the FastAPI worker binds to network interfaces.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `COLAB_WORKER_HOST` | String | `0.0.0.0` | Network host to bind FastAPI server (0.0.0.0 = all interfaces) |
| `COLAB_WORKER_PORT` | Integer | `8787` | Network port for FastAPI worker service |

### Model Training Configuration
Fine-tune the ML model training behavior.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MODEL_EPOCHS` | Integer | `5` | Number of epochs for training proxy EfficientNet-B0 model |
| `BATCH_SIZE` | Integer | `32` | Batch size for training (increase for more GPU memory, decrease for less) |
| `LEARNING_RATE` | Float | `0.0001` | Adam optimizer learning rate |

### Analysis Configuration
Control bias detection analysis parameters.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `FAIRNESS_DISPARITY_THRESHOLD` | Float | `0.15` | Subgroup accuracy disparity threshold (0.15 = 15% difference) |
| `HEATMAP_NUM_SAMPLES` | Integer | `6` | Number of sample images to generate heatmaps for (2x3 grid) |

### Storage Configuration
Configure temporary dataset storage in Colab.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `COLAB_WORK_DIR` | Path | `/content/biaslens_work` | Local directory in Colab for temporary dataset storage |
| `DATASET_S3_PREFIX` | S3 Path | (optional) | S3 prefix for dataset downloads (e.g., `s3://bucket/datasets/`) |

## Loading Order in Code

The notebook loads variables in this order (later sources override earlier ones):

```python
from dotenv import load_dotenv
from pathlib import Path

# 1. Load defaults from .env
load_dotenv(".env", override=False)

# 2. Load user-specific values from .env.local (overrides .env)
load_dotenv(".env.local", override=True)

# 3. System environment variables (highest priority)
value = os.getenv("VARIABLE_NAME")
```

## Setting Up Secrets in Colab

### Option 1: Upload .env.local file
1. Create `.env.local` locally with your secrets
2. In Colab: `Files > Upload to session`
3. Select `.env.local` file
4. Re-run Cell 2

### Option 2: Use Colab Secrets (Recommended)
1. Click "🔑" secrets icon in left sidebar
2. Create each secret (e.g., `BACKEND_CALLBACK_URL`)
3. Cell 2 will auto-load from `os.getenv()`

### Option 3: Set directly in Cell 2
```python
os.environ["BACKEND_CALLBACK_URL"] = "https://..."
os.environ["AWS_ACCESS_KEY_ID"] = "AKIA..."
# etc.
```

## Validation

Cell 2 automatically:
- ✓ Detects missing required variables
- ✓ Hides sensitive values (shows only first 8 chars)
- ✓ Warns if using placeholder values ("YOUR-..." or "your-...")
- ✓ Lists all loaded variables with their sources

Check the Cell 2 output for any ⚠️ warnings before proceeding.

## Security Best Practices

1. **Never commit `.env.local`** to Git (already in `.gitignore`)
2. **Never log sensitive values** - Cell 2 masks credentials
3. **Rotate AWS credentials** regularly in IAM console
4. **Use ngrok auth token** to reserve permanent domain (no token = temporary URLs)
5. **Verify `COLAB_SHARED_SECRET`** matches backend config exactly
6. **Audit S3 bucket permissions** - should only allow Colab worker access

## Example .env.local for Development

```ini
# Backend Configuration
BACKEND_CALLBACK_URL=https://3.110.87.92.nip.io/api/v1/webhooks/colab/job-status
BACKEND_HEALTH_URL=https://3.110.87.92.nip.io/api/v1/health
COLAB_SHARED_SECRET=my-secret-colab-key-123

# AWS S3
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
S3_BUCKET_NAME=biaslens-mvp-datasets

# Ngrok
NGROK_AUTHTOKEN=7f...aB1c2D3e4F5g6H7i8J9k

# Optional Overrides
MODEL_EPOCHS=3
BATCH_SIZE=16
```

## Troubleshooting

### Error: "BACKEND_CALLBACK_URL not found"
→ Cell 2 shows ⚠️ status
→ Check .env.local exists and has correct value
→ Verify backend URL is publicly accessible and HTTPS

### Error: "InvalidAccessKeyId" from AWS
→ Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are correct
→ Verify IAM user has S3 permissions
→ Check IAM user is not deleted or access key not revoked

### Error: "Unable to connect to ngrok"
→ Check NGROK_AUTHTOKEN is valid (get from https://dashboard.ngrok.com/auth)
→ Verify ngrok account is active (free tier requires monthly check-in)

### Variables not loading from .env
→ Ensure python-dotenv is installed: `pip install python-dotenv`
→ Check .env file is in same directory as notebook
→ Verify file format (use `.env.example` as template)
