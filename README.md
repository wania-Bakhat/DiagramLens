# BioLens

BioLens is an interactive anatomy atlas that turns a medical image into a focused, labelled 3D study experience. Learners can choose a curated organ system or upload a 2D anatomy image, inspect the corresponding realistic GLB model, select labelled structures, and ask a grounded AI tutor about what they are viewing.

## Built with Codex 5.6

BioLens was built iteratively with Codex 5.6 as the development partner behind the product experience.

Codex 5.6 helped us:

- Design and implement the Next.js, TypeScript, Tailwind, and Three.js application architecture.
- Build the upload-to-atlas workflow, including the server-side vision adapter and structured organ/part data model.
- Integrate locally supplied GLB anatomy assets with native 3D controls, selection, labels, layer visibility, and explode interactions.
- Create the grounded AI tutor flow, which scopes each response to the active organ, selected structure, and curated anatomical relationships.
- Refine the study interface through repeated feedback: improving full-screen study mode, loading states, responsive layouts, model controls, and label behaviour.
- Debug GLB loading, Git LFS asset handling, and production build issues.
- Prepare project documentation, attribution details, and deployment readiness.

Codex 5.6 was used to build and iterate on BioLens; it is not presented as a medical diagnostic tool. Runtime image recognition and tutoring remain behind swappable server-side adapters.

## Why it matters

Static diagrams make spatial anatomy difficult to learn. BioLens keeps the source image, anatomically appropriate 3D model, visible labels, structure details, and follow-up learning prompts in one calm study workflow.

## Features

- Curated 3D studies for major organs and systems, using locally supplied GLB assets.
- Image-to-atlas routing: an uploaded PNG, JPG, or WebP is visually classified on the server, then opens the matching 3D study. Filenames are never used to guess the anatomy.
- Connected labels that stay attached to the real model surface, collision-aware marker layout, structure search, visibility controls, and a **Spread labels** mode for dense diagrams.
- A diagram-aware AI tutor that receives only the active organ, selected structure, and curated relationships as context.
- Responsive dark study environment with native 3D controls and reduced-motion-aware polish.

## 3D model credits

The interactive GLB anatomy assets in `public/models/sketchfab-models/` are downloaded [Sketchfab](https://sketchfab.com/) models, all licensed **CC Attribution 4.0** ([creativecommons.org/licenses/by/4.0](https://creativecommons.org/licenses/by/4.0/)). BioLens preserves the supplied model materials and displays a Sketchfab attribution in the viewer.

Per the CC BY license, every asset below is credited to its original creator with a link back to the source model.

| Asset (`public/models/sketchfab-models/`) | title | Source |
|---|---|---|
| `skeleton.glb` | Skeleton | https://skfb.ly/CCAH |
| `heart.glb` | Realistic Human Heart | https://skfb.ly/oyBCT |
| `realistic_human_lungs.glb` | Realistic Human Lungs | https://skfb.ly/oBDWI |
| `kidney.glb` | Human Kidney | https://skfb.ly/6QUPW |
| `human_pancreas_cross_section.glb` | Human Pancreas Cross Section | https://skfb.ly/oGCIQ |
| `spleen_model.glb` | spleen | https://skfb.ly/6W9Zx |
| `reworked_cardiovascular_system.glb` | cardiovascular system | https://skfb.ly/pFFZN |
| `male_human_body.glb` | human body | https://skfb.ly/6SNKA |
| `eye.glb` | eye | https://skfb.ly/RJG7 |
| `human_brain.glb` | brain | https://skfb.ly/6ZRHv |
| `digestive_system.glb` | digestive system | https://skfb.ly/6XB7N |
| `liver.glb` | liver | https://skfb.ly/6XnBD

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Copy `.env.example` to `.env.local` and configure one server-side vision provider:

- `GROQ_API_KEY` is supported as a fallback for image recognition and powers the AI tutor.

## Verification

```bash
pnpm build
```

The production build compiles the app, type-checks it, and verifies all API routes.

## deployed on Vercel 
link: (https://bio-lens-five.vercel.app/)
