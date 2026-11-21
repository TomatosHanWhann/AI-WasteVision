# AI WasteVision
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Small static web app, browser inference, Python training. Implementation details delegated by the request to build a working, maintainable model and demo. ONNX Runtime Web is used instead of TF.js to keep a single reproducible PyTorch export; this is an implementation deviation from the proposed plan.

## Users
Thai-speaking visitors classifying one waste item at a time on phones or computers. A three-person student team maintains the project through GitHub.

## Product Purpose
Capture or upload a photo, classify plastic, metal, paper, cardboard or food organics, ask about contamination, show conditional sorting guidance, and record locally confirmed test results.

## Operating Context
Public HTTPS demo accessible from outside the local network. No account or paid inference API. Image processing stays on the device. Camera permission and an upload fallback are required.

## Capabilities and Constraints
Confidence and unknown/reject handling, local test logs and CSV export, model evaluation and a repeatable training pipeline. Model scores are not measured field accuracy. Physical-item holdout and new local Thai samples require human collection; no fabricated evidence.

## Brand Commitments
AI WasteVision, Thai interface, green direction of the supplied plan. User confirmed the Thai public demo and three-person handoff on 2026-11-21.

## Evidence on Hand
Eight-page project plan supplied by the user; empty private GitHub repository TomatosHanWhann/AI-WasteVision. RealWaste is the intended baseline data source; reports must be generated from actual runs.

## Product Principles
1. One clear scanning task.
2. Explain uncertainty and material limits.
3. Keep photos local.
4. Keep team setup and changes simple.
