[cite_start]Here is the fully rewritten Software Requirements Specification (SRS), formally integrating the clinical requirements of your PRD [cite: 67] and the distributed, memory-safe architecture of the SAD.

***

# Software Requirements Specification (SRS): Pre-Training Bias Intelligence System (MVP)

## 1. Introduction

**1.1 Purpose**
[cite_start]This document defines the functional and non-functional requirements for the MVP of a "Pre-Training Bias Intelligence System"[cite: 4]. [cite_start]The system serves as a quality control auditor for medical imaging datasets, identifying biases and shortcuts before they are codified into clinical AI models[cite: 5, 75].

**1.2 Scope**
[cite_start]The MVP focuses specifically on Radiology (Medical Imaging), including chest X-rays, skin lesion images, and MRI/CT scans[cite: 7, 88]. [cite_start]It identifies class imbalance, source variability, hidden shortcuts using visual explainability (Grad-CAM), and subgroup performance disparities[cite: 8, 128]. [cite_start]Crucially, it provides actionable fix recommendations to correct dataset diversity[cite: 145].

## 2. Overall Description

**2.1 Product Perspective**
The system operates as a decoupled, cloud-native microservices application. To bypass backend memory constraints and ensure scalability, the architecture separates state orchestration from machine learning processing:
* [cite_start]**User Interface:** React.js frontend[cite: 192].
* [cite_start]**Orchestration API:** Lightweight Python-based backend (FastAPI) managing state and task delegation[cite: 194].
* [cite_start]**Storage:** Direct-to-client cloud object storage (AWS S3) [cite: 200] and structured database (Supabase PostgreSQL).
* [cite_start]**ML Processing Node:** Ephemeral, GPU-accelerated computing environment (e.g., Google Colab) executing the machine learning inference via secure webhook tunnels[cite: 16, 196].

**2.2 User Classes and Characteristics**
* [cite_start]**AI/ML Engineers:** Primary users who upload datasets to verify integrity[cite: 13, 82].
* [cite_start]**Healthcare Researchers:** Users seeking to document data representativeness for regulatory transparency[cite: 14, 83].

**2.3 Operating Environment**
* **Frontend:** React.js with TypeScript (Hosted via Vercel).
* **Backend Orchestrator:** Python 3.10+, FastAPI (Hosted on a low-resource VPS, e.g., 1GB RAM Oracle Linux instance).
* [cite_start]**ML Worker:** Python 3.10+, PyTorch 1.13+, OpenCV[cite: 16, 196, 197].
* **Data Tier:** Supabase (IPv4-enabled PostgreSQL) and AWS S3.

## 3. System Features (MVP Functional Requirements)

**3.1 Dataset Ingestion Module (FR-1)**
* [cite_start]**Description:** The system shall allow users to upload datasets containing images (JPG, PNG, or DICOM) and an optional metadata CSV (e.g., age, gender, hospital)[cite: 21, 99, 101, 102].
* **Execution:** The React frontend will request a pre-signed URL from the FastAPI orchestrator and upload the binary files directly to AWS S3, ensuring the 1GB RAM backend only processes object URIs and metadata.

**3.2 Dataset Bias Scanner (FR-2)**
* [cite_start]**Description:** The ML Worker shall perform statistical analysis of the dataset distribution[cite: 25].
* **Sub-features:**
    * [cite_start]**Class Imbalance:** Calculate the percentage of "healthy" vs. "diseased" labels[cite: 27, 107].
    * [cite_start]**Source Imbalance:** Identify if data is heavily skewed toward a specific hospital site or scanner manufacturer[cite: 27, 108].
    * [cite_start]**Representation Check:** Flag missing or underrepresented demographic groups (e.g., age, gender) using provided metadata[cite: 28, 109].

**3.3 Hidden Bias (Shortcut) Detector (FR-3) (Core Feature)**
* [cite_start]**Description:** The system shall detect if a model is likely to learn "shortcuts" (e.g., text labels, hospital-specific markers, watermarks, corners) instead of biological pathology[cite: 33, 120, 121, 122].
* [cite_start]**Execution:** The ML Worker will train a lightweight proxy model (e.g., EfficientNet-B0) on the S3 dataset, apply Grad-CAM to generate heatmaps, and upload the outputs back to S3[cite: 35, 36, 117, 118].

**3.4 Subgroup Performance Analyzer (FR-4)**
* [cite_start]**Description:** The system shall split the dataset into demographic subgroups (e.g., Age, Gender, Source) and calculate predictive accuracy across each segment to detect outcome disparities[cite: 128, 130, 131, 132, 133].

**3.5 Bias Explanation Engine & Fix Recommendation (FR-5)**
* [cite_start]**Description:** The system shall generate a text-based report summarizing findings in plain human language[cite: 42, 141].
* [cite_start]**Fix Engine:** The system shall output actionable recommendations (e.g., "Add more samples from underrepresented groups", "Remove image artifacts")[cite: 145, 147, 149].

**3.6 Risk & Fairness Scoring (FR-6)**
* [cite_start]**Description:** The system shall provide a quantifiable "Bias Risk" (Low/Medium/High), a Fairness Score (0-100), and a Diversity Score[cite: 151, 154, 155, 156].

## 4. External Interface Requirements

**4.1 User Interface**
* [cite_start]**Upload Page:** Drag-and-drop zone for datasets[cite: 48].
* [cite_start]**Audit Dashboard:** Visual graphs (histograms/pie charts) for demographics and Grad-CAM heatmap overlays on sample images[cite: 49].
* [cite_start]**Report Page:** Summary of metrics, text-based explanations, and fix recommendations[cite: 176, 177, 179].

**4.2 Software Interfaces**
* **REST API / Webhooks:** The FastAPI backend will handle database queries via Supabase clients and utilize asynchronous webhooks to trigger and receive data from the Google Colab ML Worker.

## 5. Non-functional Requirements

**5.1 Performance & Resilience**
* [cite_start]**Proxy Training:** Training the lightweight proxy model on the ML Worker should complete within 15 minutes for standard datasets (~500-1000 images)[cite: 55].
* **Resilience:** The orchestration backend must gracefully handle disconnections from the ephemeral ML Worker, queueing tasks in PostgreSQL until a secure tunnel connection is re-established.

**5.2 Regulatory Alignment**
* [cite_start]The system shall support FDA 2025/2026 transparency guidelines by providing traceable documentation for dataset representativeness and risk assessments[cite: 60].

## 6. MVP Implementation Roadmap

1.  **Phase 1:** Build the React drag-and-drop UI and the FastAPI/S3 pre-signed URL upload pipeline. Configure Supabase PostgreSQL schema.
2.  **Phase 2:** Establish the Ngrok/Cloudflared webhook tunnel between FastAPI and the Google Colab ML Worker.
3.  [cite_start]**Phase 3:** Implement the Dataset Bias Scanner (Pandas) and Subgroup Analyzer within the Colab worker[cite: 63, 187].
4.  [cite_start]**Phase 4:** Integrate PyTorch EfficientNet-B0 for proxy training and OpenCV for Grad-CAM heatmap generation, saving outputs back to S3[cite: 64, 196, 197, 198].
5.  [cite_start]**Phase 5:** Finalize the Bias Explanation Engine, Fix Recommendations, and UI Dashboard reporting logic[cite: 66, 139, 145].