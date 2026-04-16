# Severity × Probability Matrix (MSTool-AI RMF)

## Severity (5 levels)
1. **Negligible** — inconvenience, no clinical impact
2. **Minor** — temporary discomfort, easily reversible
3. **Serious** — injury requiring intervention
4. **Critical** — permanent impairment or life-threatening injury
5. **Catastrophic** — death

## Probability (3 levels)
- **Low** — < 1 in 10,000 uses
- **Medium** — 1 in 1,000 to 1 in 10,000
- **High** — > 1 in 1,000

## Acceptability matrix
|              | Low (P) | Medium (P) | High (P) |
|--------------|---------|------------|----------|
| Negligible   | Accept  | Accept     | ALARP    |
| Minor        | Accept  | ALARP      | ALARP    |
| Serious      | ALARP   | ALARP      | Reject   |
| Critical     | ALARP   | Reject     | Reject   |
| Catastrophic | Reject  | Reject     | Reject   |

`ALARP` = As Low As Reasonably Practicable; needs documented control measure.
`Reject` = unacceptable; design must be changed.
