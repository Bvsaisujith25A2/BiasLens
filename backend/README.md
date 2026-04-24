# BiasLens Backend (FastAPI Orchestrator)

This service follows the SRSv2/SAD architecture:
- React uploads directly to AWS S3 using pre-signed URLs
- FastAPI stores job state in Supabase (with in-memory fallback)
- FastAPI triggers the Colab/ML worker via webhook
- Colab reports job progress/results back to FastAPI via secure callback

## Run locally

1. Create environment file:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. Start API:

```bash
uvicorn app.main:app --reload --port 8000
```

4. Open docs:
- http://localhost:8000/docs

## Frontend integration

Set frontend env in `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Supabase auth setup

Set these in backend .env:

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Auth routes use Supabase Auth and issue frontend bearer tokens via:

- POST /api/v1/auth/login
- POST /api/v1/auth/register

All protected routes (/users, /jobs, /analyses) require:

Authorization: Bearer <access_token>

## Key endpoints

- `POST /api/v1/upload/presigned-url`
- `POST /api/v1/jobs/start`
- `GET /api/v1/jobs/{job_id}`
- `POST /api/v1/jobs/{job_id}/cancel`
- `GET /api/v1/analyses?page=1&per_page=10`
- `GET /api/v1/analyses/{analysis_id}`
- `DELETE /api/v1/analyses/{analysis_id}`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `POST /api/v1/webhooks/colab/job-status`

## Colab callback auth

If `COLAB_SHARED_SECRET` is set, callback requests must include:

`X-Worker-Secret: <COLAB_SHARED_SECRET>`
