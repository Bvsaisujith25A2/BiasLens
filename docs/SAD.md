The System Architecture Document (SAD)
1. System Overview

A brief summary of your decoupled microservices approach, explicitly stating the goal of offloading heavy computing from the orchestration server.

2. Visual Architecture

This is the most important part of the document. A visual map showing how the React frontend talks to S3, how FastAPI manages state, and how Colab handles the heavy lifting.

3. Infrastructure Components

Presentation Tier: React (TypeScript) hosted on Vercel.

Orchestration Tier: FastAPI running on the Oracle Linux instance. Crucial addition: Note the specific hardware constraints here (1GB RAM) to justify why images bypass this server.

Processing Tier: Ephemeral Google Colab instance executing PyTorch/OpenCV for the CNN.

Storage Tier: AWS S3 for binary object storage (datasets, heatmaps) and Supabase (PostgreSQL) for structured metadata.

4. Data Flow & Orchestration

Document the exact sequence of events for your core feature. For example: React requests S3 Pre-signed URL → Uploads directly to S3 → FastAPI sends webhook to Colab tunnel → Colab downloads from S3 → Colab processes and uploads heatmaps to S3 → Colab webhooks FastAPI with completion status.

5. Network & Security Configuration

CORS Policies: Explicitly document the rules. Vercel needs CORS access to the Oracle server's IP/DNS, and the AWS S3 bucket needs a CORS policy configured to accept PUT requests directly from your Vercel domain.

Tunneling Strategy: Document how the Cloudflare (cloudflared) or Ngrok tunnel securely exposes the active Colab notebook to the Oracle server.

Authentication: Detail how the internal services talk to each other securely (e.g., passing a shared API key in the headers between Colab and FastAPI).