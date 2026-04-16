# Requirement ID Format

`REQ-<CATEGORY>-<NNN>`

## Categories
- **FUNC** — Functional: user-facing features, workflows, UI
- **SAFE** — Safety: hazard mitigations under ISO 14971
- **PERF** — Performance: latency, throughput, accuracy thresholds
- **SEC** — Security: IEC 81001-5-1 cybersecurity controls
- **USAB** — Usability: IEC 62366-1 use specification

## Numbering
- Three-digit sequential within category
- Never reused (a deleted REQ keeps its number)
- Live in `docs/iec62304/02_Software_Requirements_Specification.md`

## Safety class mapping (default)
- SAFE / PERF → Class C requirement
- SEC → Class B
- FUNC / USAB → Class A unless explicitly tagged
