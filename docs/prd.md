📄 Product Requirements Document (PRD)
Project: Pre-Training Bias Intelligence System for Medical Imaging AI

1. 🧠 Product Overview
1.1 Problem Statement
AI models in medical imaging (e.g., X-rays, MRI) are often trained on biased datasets, leading to:
Unequal diagnosis across patient groups
Poor performance in real-world scenarios
Hidden errors that are difficult to detect
Currently, there is no simple system that checks dataset bias BEFORE training AI models.

1.2 Solution
We are building a platform where:
👉 Users upload a medical imaging dataset
👉 System analyzes it for bias
👉 Detects hidden patterns and risks
👉 Explains WHY bias exists
👉 Suggests how to fix it

1.3 Product Vision
“Make bias in medical AI datasets visible, measurable, and preventable before model training.”

2. 🎯 Target Users
AI/ML Engineers
Healthcare AI Researchers
Students & Hackathon Teams
Startups building medical AI

3. 🏥 Scope (IMPORTANT)
Domain Focus:
👉 Medical Imaging (Radiology)
Chest X-rays
Skin lesion images
MRI/CT scans
❌ Not covering:
Chatbots
Wearables
EHR systems (for now)

4. ⚙️ Core Features

4.1 Dataset Upload Module
Description:
Users upload dataset (images + optional metadata)
Inputs:
Images (JPG, PNG, DICOM optional)
CSV (optional: age, gender, hospital)
Output:
Dataset accepted and processed

4.2 Dataset Bias Scanner
What it checks:
Class imbalance (disease vs healthy)
Source imbalance (hospital/device)
Missing groups (age, gender)
Output:
Visual graphs (distribution)
Alerts:
“Dataset heavily skewed”
“Underrepresented group detected”

4.3 Hidden Bias Detector (CORE FEATURE)
Method:
Train lightweight test model internally
Apply explainability (Grad-CAM)
Detects:
Model focusing on:
Corners
Watermarks
Background patterns
Output:
Heatmaps
Warning:
“Model is learning shortcuts instead of medical features”

4.4 Subgroup Performance Analyzer
What it does:
Splits dataset into subgroups:
Age
Gender
Source
Output:
Accuracy comparison per group
Example:
Group A: 90%
Group B: 60% → ⚠️ Bias

4.5 Bias Explanation Engine
Purpose:
Explain bias clearly in human language
Output example:
“Bias occurs because 80% of images come from one hospital”
“Model relies on image artifacts instead of disease patterns”

4.6 Fix Recommendation System (KEY DIFFERENTIATOR)
Suggests:
Add more samples from underrepresented groups
Balance dataset
Remove image artifacts
Improve data diversity

4.7 Risk & Fairness Score
Instead of fake “95% safe”
Provide:
Bias Risk: Low / Medium / High
Fairness Score (0–100)
Diversity Score

5. 🧩 User Flow
User logs in
Uploads dataset
System processes data
Runs:
Bias scan
Hidden bias detection
Subgroup testing
Generates report
User views:
Issues
Explanations
Fix suggestions

6. 🖥️ UI Components
Upload Page
Dashboard:
Dataset distribution graphs
Heatmaps
Bias alerts
Report Page:
Summary
Risk score
Recommendations

7. 🧪 MVP (Minimum Viable Product)
Must-have:
Image upload
Basic imbalance detection
Simple heatmap (Grad-CAM demo)
Bias report (text-based)
Nice-to-have:
Subgroup analysis
Fix recommendations
Scoring system

8. 🛠️ Tech Stack (Suggested)
Frontend:
React.js
Backend:
Python (FastAPI / Flask)
AI/ML:
PyTorch / TensorFlow
OpenCV
Grad-CAM
Storage:
Local / Cloud (Firebase, AWS S3 optional)

9. 📊 Success Metrics
Accuracy of bias detection
Clarity of explanations
User understanding
Demo effectiveness (for judges)

10. ⚠️ Limitations
Cannot detect ALL biases
Requires human interpretation
Works best with labeled data

11. 🚀 Future Scope
Support for non-imaging healthcare AI
Integration into ML pipelines
Real-time bias monitoring
Automated dataset correction

12. 🎤 Pitch Summary
“We built a pre-training bias intelligence system that detects, explains, and helps fix hidden biases in medical imaging datasets before AI models are trained, reducing unfair outcomes in healthcare.”

13. 🧠 Key Takeaway
👉 This is NOT:
A model builder
👉 This IS:
A quality control system for AI datasets

✅ Final Clarity for Team
Problem → Biased datasets
Solution → Detect before training
Focus → Medical imaging
Strength → Explain + Fix (not just detect)