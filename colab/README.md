# BiasLens Colab ML Worker

The ML worker is a FastAPI service running on Google Colab (or any Python environment with GPU access). It performs the heavy lifting for bias detection:

- **Grad-CAM Heatmap Generation**: Identifies visual shortcuts in medical images using EfficientNet-B0
- **Proxy Model Training**: Trains a lightweight CNN to detect if the model can learn pathology from images or just artifacts
- **Subgroup Analysis**: Splits datasets by demographic attributes and detects fairness disparities
- **Statistical Analysis**: For tabular datasets (CSV, Parquet, JSON)

## Architecture Overview

```
Frontend (React)
    ↓ upload dataset to S3
    ↓ start job
FastAPI Backend (Oracle VPS, 1GB RAM)
    ↓ webhook /run-analysis
    ↓ (via ngrok tunnel)
Colab ML Worker (Free T4 GPU)
    ├─ Download from S3
    ├─ Train EfficientNet-B0
    ├─ Generate Grad-CAM heatmaps
    ├─ Analyze subgroup fairness
    └─ Upload results to S3 + webhook callback
    ↓
Backend receives results
    ↓
Dashboard displays bias findings
```

## How to Run

### Option A: Google Colab (Recommended for MVP)

1. Open [worker_service.ipynb](./worker_service.ipynb) in Google Colab
2. **Cell 1**: Run to install dependencies (torch, torchvision, opencv, etc.)
3. **Cell 2**: Configure environment variables:
   - `BACKEND_CALLBACK_URL`: Your backend's webhook endpoint (must be public HTTPS)
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: For S3 access
   - `S3_BUCKET_NAME`: Where to upload heatmaps
4. **Cells 3–4**: Load ML modules and FastAPI service
5. **Cell 5**: Start worker server
6. **Cell 6**: Expose via ngrok and copy the public URL

Example Cell 2 configuration:

```python
import os

os.environ["BACKEND_CALLBACK_URL"] = "https://YOUR-BACKEND-URL/api/v1/webhooks/colab/job-status"
os.environ["AWS_REGION"] = "us-east-1"
os.environ["AWS_ACCESS_KEY_ID"] = "your-iam-key"
os.environ["AWS_SECRET_ACCESS_KEY"] = "your-iam-secret"
os.environ["S3_BUCKET_NAME"] = "your-bucket"
os.environ["COLAB_SHARED_SECRET"] = "optional-shared-secret"
```

### Option B: Local Python Environment

```bash
cd colab
pip install -r requirements.txt
export BACKEND_CALLBACK_URL=http://localhost:8000/api/v1/webhooks/colab/job-status
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export S3_BUCKET_NAME=your-bucket
python worker_service.py
```

## API Endpoints

### Health Check

```bash
curl http://localhost:8787/health
# Response: {"status":"ok","service":"biaslens-ml-worker"}
```

### Trigger Analysis Job

```bash
curl -X POST http://localhost:8787/run-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "job-123",
    "s3_object_uri": "s3://my-bucket/datasets/chest-xray.zip",
    "dataset_name": "ChestX-Ray14",
    "analysis_options": {
      "check_class_imbalance": true,
      "check_source_variability": true,
      "detect_hidden_bias": true
    },
    "callback_url": "https://backend/api/v1/webhooks/colab/job-status"
  }'

# Response: {"accepted":true,"job_id":"job-123"}
```

## Input Dataset Format

### Image Dataset (ZIP)

Create a ZIP file with this structure:

```
my-dataset.zip
├── positive/
│   ├── img001.jpg
│   ├── img002.jpg
│   └── ...
├── negative/
│   ├── img101.jpg
│   ├── img102.jpg
│   └── ...
└── metadata.csv (optional)
```

**metadata.csv** should contain:

```
filename,label,age,gender,source,institution
img001.jpg,positive,45,M,Hospital A,Johns Hopkins
img002.jpg,positive,52,F,Hospital B,Mayo Clinic
...
```

The worker will:
1. Extract images from subdirectories
2. Infer labels from folder names (positive/negative, diseased/healthy, etc.)
3. Train EfficientNet-B0 on the dataset
4. Generate Grad-CAM heatmaps for 6 sample images
5. Analyze performance across demographic subgroups (age, gender, source)
6. Return model accuracy, heatmaps, and fairness metrics

### Tabular Dataset (CSV/Parquet)

For non-image datasets, upload a CSV or Parquet file. The worker will run statistical bias analysis (class imbalance, source variability, hidden bias patterns).

## Output Results

After analysis completes, the worker sends a webhook to `BACKEND_CALLBACK_URL` with:

```json
{
  "job_id": "job-123",
  "status": "COMPLETED",
  "progress": 100,
  "current_step": "Analysis complete",
  "results": {
    "dataset_type": "image",
    "total_images": 5000,
    "model_accuracy": 89.5,
    "fairness_score": 72.3,
    "class_distribution": [
      {"label": "healthy", "count": 3200, "percentage": 64.0},
      {"label": "diseased", "count": 1800, "percentage": 36.0}
    ],
    "subgroup_analysis": {
      "subgroups": [
        {
          "name": "Hospital A",
          "accuracy": 91.2,
          "sample_count": 1500
        },
        {
          "name": "Hospital B",
          "accuracy": 78.5,
          "sample_count": 1200
        }
      ],
      "disparity_percent": 12.7,
      "disparity_detected": true
    },
    "heatmap_url": "s3://bucket/heatmaps/job-123/gradcam_collage.png",
    "explanation": "The proxy model achieved 89.5% accuracy. Class distribution is somewhat imbalanced (64/36 split). Significant performance disparities detected across demographic groups (12.7% variance), suggesting potential shortcut learning...",
    "bias_risk": "medium",
    "warnings": [...]
  }
}
```

## Environment Variables Reference

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `BACKEND_CALLBACK_URL` | Yes | `https://api.example.com/.../job-status` | Must be publicly accessible HTTPS |
| `COLAB_SHARED_SECRET` | No | `super-secret-key` | For X-Worker-Secret validation |
| `AWS_REGION` | Yes | `us-east-1` | AWS region for S3 |
| `AWS_ACCESS_KEY_ID` | Yes | `AKIAIOSFODNN7EXAMPLE` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` | IAM user secret key |
| `AWS_SESSION_TOKEN` | No | Empty for IAM user | Only for temporary STS credentials |
| `S3_BUCKET_NAME` | Yes | `biaslens-data` | Where to upload heatmap results |
| `COLAB_WORKER_HOST` | No | `0.0.0.0` | Binding address (default: 0.0.0.0) |
| `COLAB_WORKER_PORT` | No | `8787` | Server port (default: 8787) |

## ML Pipeline Details

### 1. Model Training

- **Architecture**: EfficientNet-B0 (pretrained on ImageNet)
- **Input**: 224×224 RGB images
- **Output**: Binary classification (healthy/diseased)
- **Training**: 5 epochs with Adam optimizer, LR scheduler
- **Validation**: 80/20 train/val split

### 2. Grad-CAM Heatmap Generation

- **Method**: Gradient-weighted Class Activation Mapping
- **Target Layer**: EfficientNet-B0 final convolution block
- **Output**: 2×3 collage of 6 sample images with heatmap overlays (red = high activation)
- **Purpose**: Identify which image regions the model uses for predictions (detects shortcuts like text labels, scanner artifacts, watermarks)

### 3. Subgroup Fairness Analysis

- **Groups**: Demographic splits by age, gender, hospital/source, scanner manufacturer
- **Metric**: Accuracy disparity (%) between subgroups
- **Threshold**: >15% disparity = fairness violation
- **Recommendation**: Augment underrepresented groups or apply fairness-aware training

## Troubleshooting

### 1. "asyncio.run() cannot be called from a running event loop"

**Fix**: Use `start_worker()` function instead of `uvicorn.run()`. The function auto-detects Jupyter event loops.

### 2. "ModuleNotFoundError: No module named 'torch'"

**Fix**: Install all dependencies in Cell 1 of the notebook. For local Python:

```bash
pip install torch torchvision opencv-python
```

### 3. "CUDA out of memory"

**Fix**: The worker defaults to CPU if GPU memory is exceeded. For large datasets (>10GB images), reduce batch size in `worker_service.py` line ~200:

```python
train_loader = DataLoader(train_dataset, batch_size=8, ...)  # Reduce from 16
```

### 4. "SSL: CERTIFICATE_VERIFY_FAILED" when posting webhook

**Fix**: Ensure `BACKEND_CALLBACK_URL` uses valid HTTPS certificate. If local dev:

```python
import ssl
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False  # DEBUG ONLY
```

### 5. Ngrok tunnel disconnects

**Fix**: Ngrok has a 2-hour session limit. Reconnect Cell 6, update backend `COLAB_TRIGGER_URL` with new URL.

## Performance Benchmarks (on Colab T4 GPU)

| Dataset Size | Training Time | Heatmap Gen | Total |
|--------------|---------------|------------|-------|
| 500 images | 3 min | 1 min | 4 min |
| 1,000 images | 5 min | 2 min | 7 min |
| 5,000 images | 15 min | 5 min | 20 min |
| 10,000+ images | 30+ min | 10+ min | 40+ min |

## Production Deployment

For production (beyond MVP):

1. **Self-Hosted Worker**: Run on AWS p3 instance with persistent FastAPI service (instead of Colab)
2. **Job Queue**: Use RabbitMQ or SQS for async job scheduling
3. **Worker Monitoring**: Add Prometheus metrics + Grafana dashboard
4. **Fault Tolerance**: Implement job retry logic and dead-letter queues
5. **Scaling**: Deploy multiple worker replicas behind load balancer


## 4) Expose worker publicly from Colab

If running in Colab, use any HTTPS tunnel and put that URL into `COLAB_TRIGGER_URL`.

Example with pyngrok in a notebook cell:

```python
!pip install pyngrok
from pyngrok import ngrok
public_url = ngrok.connect(8787, bind_tls=True)
print(public_url)
```

Then set backend `COLAB_TRIGGER_URL` to:

`<public_url>/run-analysis`

## 5) Trigger flow

1. Frontend uploads file to S3 via presigned URL.
2. Frontend calls backend `POST /api/v1/jobs/start`.
3. Backend calls worker `POST /run-analysis`.
4. Worker posts progress/results to backend callback URL.

## Input payload (from backend to worker)

```json
{
  "job_id": "uuid",
  "s3_object_uri": "s3://bucket/key.csv",
  "dataset_name": "dataset.csv",
  "analysis_options": {
    "check_class_imbalance": true,
    "check_source_variability": true,
    "detect_hidden_bias": true
  },
  "callback_url": "https://.../api/v1/webhooks/colab/job-status"
}
```

## Output callback payloads (worker to backend)

Progress update:

```json
{
  "job_id": "uuid",
  "status": "PROCESSING",
  "progress": 70,
  "current_step": "Running bias checks"
}
```

Completion update:

```json
{
  "job_id": "uuid",
  "status": "COMPLETED",
  "progress": 100,
  "current_step": "Analysis complete",
  "results": {
    "fairness_score": 72.5,
    "diversity_score": 68.2,
    "total_samples": 1000,
    "analyzed_samples": 1000,
    "class_imbalance": [],
    "source_variability": [],
    "bias_detections": [],
    "warnings": [],
    "bias_risk": "medium"
  }
}
```

Failure update:

```json
{
  "job_id": "uuid",
  "status": "FAILED",
  "progress": 100,
  "current_step": "Worker failed",
  "error_message": "..."
}
```
