Software Requirements Specification
(SRS): Pre-Training Bias Intelligence
System (MVP)
1. Introduction
1.1 Purpose
This document defines the functional and non-functional requirements for the MVP of a
"Pre-Training Bias Intelligence System." The system serves as a quality control auditor for
medical imaging datasets, identifying biases before they are codified into clinical AI models.
1.2 Scope
The MVP focuses specifically on Radiology (Medical Imaging), including chest X-rays, skin
lesion images, and MRI/CT scans. It identifies class imbalance, source variability, and hidden
shortcuts using visual explainability .
2. Overall Description
2.1 Product Perspective
The system operates as a standalone web application. It utilizes a React.js frontend and a
Python-based backend (Flask or FastAPI) to handle image processing and machine learning
inference.
2.2 User Classes and Characteristics
● AI/ML Engineers: Primary users who upload datasets to verify integrity.
● Healthcare Researchers: Users seeking to document data representativeness for
regulatory transparency.

2.3 Operating Environment
● Backend: Python 3.10+, PyTorch 1.13+, OpenCV.
● Asynchronous Processing: Celery + Redis for long-running proxy model training
tasks.

3. System Features (MVP Functional Requirements)
3.1 Dataset Ingestion Module
● Requirement ID: FR-1

● Description: The system shall allow users to upload datasets containing images (JPG,
PNG, or DICOM) and an optional metadata CSV.
● Action: Validates image file integrity using MD5 hashing and checks for corrupt files or
duplicates .

3.2 Dataset Bias Scanner
● Requirement ID: FR-2
● Description: The system shall perform statistical analysis of the dataset distribution.
● Sub-features:
○ Class Imbalance: Calculate percentage of "healthy" vs. "diseased" labels.
○ Source Imbalance: Identify if data is heavily skewed toward a specific hospital
site or scanner manufacturer.
○ Representation Check: Flag missing or underrepresented demographic groups
(e.g., age, gender) if metadata is provided .

3.3 Hidden Bias (Shortcut) Detector
● Requirement ID: FR-3
● Description: The system shall detect if a model is likely to learn "shortcuts" (e.g., text
labels, hospital-specific markers) instead of biological pathology.
● Methodology:
○ Train a lightweight proxy model (e.g., EffiRadNet or EfficientNet-B0) on a
subset of the data .
○ Apply Grad-CAM to generate heatmaps highlighting the regions most influential
to the model's predictions .

● Alert: Generate a warning if high-intensity gradients are consistently located in
non-anatomical areas like image corners or near digital watermarks.

3.4 Bias Explanation Engine & Report
● Requirement ID: FR-4
● Description: The system shall generate a text-based report summarizing findings in
human language.
● Metrics: Provide a Fairness Score (0–100) and a Diversity Score .
● Language: e.g., "Warning: 80% of pneumonia labels are associated with a specific
hospital marker; the model may be learning the marker instead of pathology".

4. External Interface Requirements
4.1 User Interface

● Upload Page: Drag-and-drop zone for datasets.
● Audit Dashboard: Visual graphs (histograms/pie charts) for demographics and
Grad-CAM heatmap overlays on sample images .

4.2 Software Interfaces
● REST API: The Flask backend will expose endpoints for /upload, /analyze, and /report.
● Fairness Libraries: Integration with AIF360 for calculating metrics like Equal
Opportunity Difference (EOD) .

5. Non-functional Requirements
5.1 Performance
● Proxy Training: Training the lightweight proxy model should complete within 15 minutes
for standard datasets (~500–1000 images) .
● Inference: Generating heatmaps should take <30 seconds per dataset scan.

5.2 Regulatory Alignment
● The system shall support FDA 2025/2026 transparency guidelines by providing
traceable documentation for dataset representativeness and risk assessments.

6. MVP Implementation Roadmap
1. Phase 1: Build the Flask/React upload pipeline.
2. Phase 2: Implement the Scanner using Pandas/OpenCV for class distribution analysis .
3. Phase 3: Integrate a pre-trained EfficientNet-B0 for proxy training and Grad-CAM
heatmap generation .
4. Phase 4: Finalize the "Risk & Fairness Score" logic and text report generation.