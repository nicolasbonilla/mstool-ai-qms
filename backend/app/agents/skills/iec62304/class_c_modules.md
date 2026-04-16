# Class C Modules — MSTool-AI medical device repository

Source of truth for which paths are Class C under IEC 62304 §4.3. Any
modification of these paths requires:

- Code review per CODEOWNERS
- Unit test coverage with documented results
- Risk re-evaluation per ISO 14971 §7
- Hazard reference (HAZ-NN) in PR description

## Backend services (Class C)
- `backend/app/services/ai_segmentation_service.py` — Vertex AI proxy for SynthSeg/FreeSurfer
  - Hazards: HAZ-001 (incorrect segmentation), HAZ-002 (model drift on new scanner)
- `backend/app/services/brain_volumetry_service.py` — Voxel counting + normative comparison
  - Hazards: HAZ-003 (incorrect volumetry), HAZ-004 (false abnormality flag)
- `backend/app/services/brain_report_service.py` — Claude API report generation
  - Hazards: HAZ-005 (clinical hallucination), HAZ-006 (PHI leak in prompt)
- `backend/app/services/lesion_analysis_service.py` — Connected components, DIS criteria
  - Hazards: HAZ-007 (lesion under-detection), HAZ-008 (DIS false positive)
- `backend/app/services/ms_region_classifier.py` — MAGNIMS region classification
  - Hazards: HAZ-009 (mis-classified PV/JC/IT/DWM region)

## Backend utils (Class C)
- `backend/app/utils/nifti_utils.py` — NIfTI I/O
  - Hazards: HAZ-010 (silently corrupted file), HAZ-011 (orientation flip)
- `backend/app/utils/dicom_utils.py` — DICOM read/write
  - Hazards: HAZ-012 (PHI leak), HAZ-013 (wrong patient association)

## Frontend (Class C)
- `frontend/src/workers/edgeAI.worker.ts` — ONNX inference in browser
  - Hazards: HAZ-014 (model load tampering), HAZ-015 (incorrect screening verdict)
