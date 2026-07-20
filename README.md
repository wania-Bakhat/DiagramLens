# BioLens

BioLens is an interactive anatomy atlas that turns a medical image into a focused, labelled 3D study experience. Learners can choose a curated organ system or upload a 2D anatomy image, inspect the corresponding realistic GLB model, select labelled structures, and ask a grounded AI tutor about what they are viewing.

## Why it matters

Static diagrams make spatial anatomy difficult to learn. BioLens keeps the source image, anatomically appropriate 3D model, visible labels, structure details, and follow-up learning prompts in one calm study workflow.

## Features

- Curated 3D studies for major organs and systems, using locally supplied GLB assets.
- Image-to-atlas routing: an uploaded PNG, JPG, or WebP is visually classified on the server, then opens the matching 3D study. Filenames are never used to guess the anatomy.
- Connected labels that stay attached to the real model surface, collision-aware marker layout, structure search, visibility controls, and a **Spread labels** mode for dense diagrams.
- A diagram-aware AI tutor that receives only the active organ, selected structure, and curated relationships as context.
- Responsive dark study environment with native 3D controls and reduced-motion-aware polish.

## 3D model credits

The interactive GLB anatomy assets in `public/models/sketchfab-models/` are locally supplied [Sketchfab](https://sketchfab.com/) model downloads. BioLens preserves the supplied model materials and displays a Sketchfab attribution in the viewer.

Included reference assets: `heart.glb`, `realistic_human_lungs.glb`, `human_brain.glb`, `kidney.glb`, `liver.glb`, `eye.glb`, `human_pancreas_cross_section.glb`, `digestive_system.glb`, `spleen_model.glb`, `reworked_cardiovascular_system.glb`, `skeleton.glb`, and `male_human_body.glb`.

Before publishing, verify and retain the original creator names, model pages, and license terms for every supplied asset in the final repository and Devpost submission.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Copy `.env.example` to `.env.local` and configure one server-side vision provider:

- `OPENAI_API_KEY` uses GPT-5.6 for image recognition (the preferred OpenAI Build Week demo configuration).
- `GROQ_API_KEY` is supported as a fallback for image recognition and powers the AI tutor.

Never expose either key with a `NEXT_PUBLIC_` prefix.

## Verification

```bash
pnpm build
```

The production build compiles the app, type-checks it, and verifies all API routes.

## OpenAI Build Week notes

BioLens is prepared for the **Education** track. The project uses Codex throughout product refinement, interaction implementation, API integration, and production verification. GPT-5.6 is the preferred vision model for turning an uploaded anatomy image into the appropriate interactive 3D study; Codex was used to build and refine the surrounding product experience.

Before submitting, replace the placeholder API configuration with a valid key, record a sub-three-minute narrated demo showing the upload-to-3D flow and AI tutor, add the `/feedback` Codex session ID, and publish the repository with an appropriate license (or share a private repository with the required Devpost reviewers). Confirm that every supplied model, thumbnail, and third-party asset has permission for this use.

## Suggested demo flow

1. Start from the clean BioLens home screen and choose a major system.
2. Rotate the real 3D model, turn on **Spread labels**, then select a structure without losing the model.
3. Show the structure details and ask the AI tutor a focused question.
4. Upload a 2D anatomy image and show it route to the matching study.
5. Close by explaining how Codex and GPT-5.6 made the image-to-interactive-atlas workflow possible.
