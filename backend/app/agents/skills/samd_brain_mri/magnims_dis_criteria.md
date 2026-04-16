# MAGNIMS DIS (Dissemination In Space) Criteria

Used by `ms_region_classifier.py` and `lesion_analysis_service.py`.

## DIS — needs ≥1 lesion in ≥2 of 4 typical MS regions

1. **Periventricular (PV)** — within 3 mm of lateral ventricles
2. **Juxtacortical / Cortical (JC)** — within 4 mm of cortex
3. **Infratentorial (IT)** — brainstem, cerebellum, fourth ventricle
4. **Spinal cord** — not currently in MSTool-AI scope (cervical-only studies)

For our pipeline:
- IT detected via FreeSurfer labels {7, 8, 16, 46, 47}
- PV detected via Euclidean distance transform from ventricles {4, 43}
- JC detected via distance transform from cortex {3, 42}
- DWM (deep white matter) is the residual

## Confidence rules
- Distance ≤ stated threshold → high confidence
- Distance within 1mm of threshold → medium
- Beyond threshold + on tier-1 fallback (geometric) → low

## Reporting
- DIS verdict surfaced in `brain_report_service` only when ≥2 region groups
  contain ≥1 lesion — never below threshold
- Always hedge: "Findings consistent with DIS per MAGNIMS criteria; clinical
  correlation recommended."
