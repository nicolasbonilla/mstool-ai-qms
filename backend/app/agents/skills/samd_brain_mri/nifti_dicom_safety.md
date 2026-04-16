# NIfTI / DICOM Safety Invariants

These invariants must hold in any code that touches medical imaging
input. The SaMD scanner (`samd_scanner.py`) flags violations.

## NIfTI
- `nib.load(path)` MUST be wrapped in try/except to handle corrupted files
- File size > 0 check before loading
- Affine matrix validated (no NaN, determinant not zero)
- Data dtype confirmed: uint8 for masks, float32 for volumes
- Orientation re-aligned to RAS+ before any voxel arithmetic

## DICOM
- `pydicom.dcmread(path)` MUST be wrapped in try/except
- PHI fields (`PatientName`, `PatientID`, `PatientBirthDate`) MUST be
  routed through the de-identification helper before any logging or
  prompt construction
- Patient identity validated against the study UID before report attribution
- Series description checked to ensure expected modality (MR, T1/T2/FLAIR)

## Voxel access
- Index access on 3D arrays MUST be bounds-checked when index source is
  user-provided or derived from external coordinates:
  ```python
  if not (0 <= z < shape[0] and 0 <= y < shape[1] and 0 <= x < shape[2]):
      raise ValueError("voxel out of bounds")
  ```
- Division on segmentation/volumetry results MUST guard against zero:
  ```python
  if denominator == 0: return 0.0
  ```

## Models (ONNX, Vertex AI)
- ONNX model file MUST have its SHA-256 verified against a pinned hash
- Vertex AI calls MUST timeout (default 60s) and have a fallback message
- Model version pinned to a SOUP entry in `requirements.txt`
