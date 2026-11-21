# AI WasteVision
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Small Vite web app, browser inference, Python training, Cloudflare Worker and D1 for loyalty. Implementation details delegated by the request to build a working, maintainable model and demo. ONNX Runtime Web is used instead of TF.js to keep a single reproducible PyTorch export; this is an implementation deviation from the proposed plan.

## Users
Thai-speaking visitors classifying one waste item at a time on phones or computers. A three-person student team maintains the project through GitHub.

## Product Purpose
Capture or upload a photo, classify plastic, metal, paper, cardboard, food organics or glass, ask about contamination, show conditional sorting guidance, and optionally confirm one item toward a phone-only loyalty card.

## Operating Context
Public HTTPS demo accessible from outside the local network. No account or paid inference API. Image processing stays on the device. Camera permission and an upload fallback are required.

## Capabilities and Constraints
Confidence and trained unknown/reject handling, a formal public information page and guide, reviewed Thai-market product examples, model evaluation and a repeatable training pipeline. Phone-only loyalty has no OTP and does not prove physical disposal. Model scores are not measured field accuracy. Physical-item holdout and new local Thai samples require human collection; no fabricated evidence.

## Brand Commitments
AI WasteVision, Thai interface, green direction of the supplied plan. User confirmed the Thai public demo and three-person handoff on 2026-11-21.

## Evidence on Hand
Eight-page project plan supplied by the user; empty private GitHub repository TomatosHanWhann/AI-WasteVision. RealWaste is the intended baseline data source; reports must be generated from actual runs.

## Product Principles
1. One clear scanning task.
2. Explain uncertainty and material limits.
3. Keep photos local.
4. Keep team setup and changes simple.

Approved extension: remove public team/developer content, use formal Thai, add presentation.html, increase Thai-market examples, and award grade A at 1,000 confirmed items. No delegation requested. The small Thai SKU holdout currently scores 25%; robust Thai-brand claims are prohibited.

Approved multi-object extension: 1–10 separated objects, per-item boxes/counts and disposal profiles, special battery/e-waste precautions, 0–100 calibrated confidence and voluntary evaluation feedback. Preserve formal Thai and green identity. Confidence is never labelled measured per-frame accuracy. Metadata/image consent is explicit and separate; private review precedes training. No unreviewed automatic self-training. The current detector has low recall and remains experimental.

Latest approved design: mobile-first Italian luxury, appropriate desktop composition, formal Thai, a complete user-journey QA and README-led handoff. The earlier forest/mint visual direction is superseded. Keep the existing live URL, source repository, capabilities, consent boundaries and measured model limitations. Do not make the private GitHub repository public without explicit authorisation.
