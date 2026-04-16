# Brain MRI Pipeline (MSTool-AI)

```
DICOM upload  →  PHI de-identification (dicom_utils)
              →  NIfTI conversion (nifti_utils)
              →  Pre-processing (skull strip, intensity normalize)
              →  AI segmentation (Vertex AI: SynthSeg or FreeSurfer)
              →  Volumetry (brain_volumetry_service)
              →  Lesion analysis (lesion_analysis_service)
              →  Region classification MAGNIMS (ms_region_classifier)
              →  Optional: Edge AI screening (frontend ONNX worker)
              →  Report generation (Claude via brain_report_service)
              →  Clinician review + sign-off
```

## Class C interfaces
- DICOM → NIfTI conversion is Class C because orientation errors propagate downstream
- Volumetry depends on segmentation correctness
- Report generator must NEVER assert diagnosis; must hedge per FDA labeling guidance

## Key invariants
- All NIfTI volumes use RAS+ orientation internally
- Segmentation masks are uint8 with FreeSurfer label set
- Lesion masks are uint8 binary
- All voxel coordinates honored as (z, y, x) — never (x, y, z)
