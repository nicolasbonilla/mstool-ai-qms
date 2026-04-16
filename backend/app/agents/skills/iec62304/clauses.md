# IEC 62304 Clauses — concise reference for agents

## §5 Software Development Process
- **5.1 Software Development Planning** — SDP must exist with lifecycle, deliverables, quality gates. Class C requires formal quality-gate approvals.
- **5.2 Software Requirements Analysis** — SRS with categorized REQ-IDs (FUNC, SAFE, PERF, SEC, USAB). Class C requires bidirectional traceability.
- **5.3 Software Architectural Design** — SAD with module decomposition + safety class per item. Class C must identify hazards per item.
- **5.4 Software Detailed Design** — Mandatory for Class C; algorithm + data structure + error handling per unit.
- **5.5 Unit Implementation & Verification** — Coding standards, code review records, unit tests for every Class C unit.
- **5.6 Software Integration Testing** — Integration test plan, CI runs, interface verification.
- **5.7 Software System Testing** — System tests trace back to SRS; acceptance criteria documented.
- **5.8 Software Release** — Release notes + known anomalies + version pinning of every dependency.

## §6 Software Maintenance Process
- **6.1 Establish maintenance plan**
- **6.2 Problem and modification analysis** — Anomaly logging + change-request gating

## §7 Software Risk Management Process
- **7.1 Risk control measures** — Each risk control links to a software requirement
- **7.2 Risk control verification** — Each control verified for implementation AND effectiveness (ISO 14971 §7.3)

## §8 Software Configuration Management
- **8.1 Configuration identification** — Every artifact uniquely identified + version controlled
- **8.2 Change control** — Change requests reviewed + approved before merge
- **8.3 Configuration status accounting**

## §9 Software Problem Resolution Process
- **9.1 Prepare reports** — Problem reports with classification
- **9.2-9.7 Investigation, control, evaluation**

## Class C Specifics
- Code review for every change (5.5.3)
- Unit testing of every unit (5.5.5)
- Integration testing required (5.6)
- Detailed unit design documentation (5.4 — most failed clause)
- All software items in architecture identified for hazard contribution (5.3.4)
