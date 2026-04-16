# Verification Requirements — ISO 14971 §7.3

Each risk control measure (RC-NN) must have TWO verifications:

## 1. Verification of Implementation
- The control IS present in the code/design
- Evidence: code snippet, design document section, configuration file

## 2. Verification of Effectiveness
- The control ACTUALLY reduces the risk
- Evidence: test result, measurement, simulation, clinical study

## Anti-patterns to flag
- Single verification (only implementation, not effectiveness)
- Verification by inspection alone for Critical/Catastrophic hazards
- Verification predates the most recent code change to the control
- Verification not tied to a specific test ID or measurement
