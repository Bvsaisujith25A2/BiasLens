# BiasLens Colab Worker

This worker receives jobs from the FastAPI backend, downloads the uploaded dataset, runs baseline bias checks, and sends status/results back via webhook.

## 1) Install and run locally or in Colab

```bash
cd colab
pip install -r requirements.txt
python worker_service.py
```

Worker endpoint:

- `POST /run-analysis`
- `GET /health`

Default port: `8787`

## 2) Required environment variables for worker runtime

Set these in Colab (or a local `.env` if you run locally):

- `BACKEND_CALLBACK_URL` example: `https://<your-backend>/api/v1/webhooks/colab/job-status`
- `COLAB_SHARED_SECRET` must match backend `COLAB_SHARED_SECRET` if backend secret check is enabled
- `AWS_REGION` (if dataset URI is `s3://...`)
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (if using IAM user credentials)
- `AWS_SESSION_TOKEN` only when using temporary STS credentials

## 3) Point backend to worker

In backend `.env.local`:

```dotenv
COLAB_TRIGGER_URL=https://<public-worker-url>/run-analysis
COLAB_SHARED_SECRET=<same-secret-used-in-worker>
BACKEND_PUBLIC_URL=https://<public-backend-url>
```

If backend runs on localhost, expose it publicly (for worker callback) using a tunnel.

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
