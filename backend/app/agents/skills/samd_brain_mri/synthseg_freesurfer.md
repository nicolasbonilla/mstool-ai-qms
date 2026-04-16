# SynthSeg / FreeSurfer Model Contract

## SynthSeg
- 33 brain structure labels (FreeSurfer label set subset)
- Trained for contrast-agnostic segmentation across T1/T2/FLAIR
- Vertex AI endpoint: `VERTEX_AI_ENDPOINT_*` env var
- Latency budget: <60s on CPU instance, <10s on GPU
- Acceptable Dice vs ground truth: ≥ 0.85 for cortical, ≥ 0.90 for subcortical

## FreeSurfer label set (subset used)
- 4, 43 — left/right lateral ventricle
- 3, 42 — left/right cerebral cortex
- 7, 46 — left/right cerebellum cortex
- 8, 47 — left/right cerebellum white matter
- 16 — brainstem
- 10, 49 — left/right thalamus
- 11, 50 — left/right caudate
- 12, 51 — left/right putamen
- 17, 53 — left/right hippocampus
- 18, 54 — left/right amygdala

## Drift signals to watch
- Label distribution shift (one structure suddenly missing >5% of cases)
- Per-structure volume mean shift > 2σ
- Inference latency p95 > 90s (suggests endpoint cold-start or GPU loss)
