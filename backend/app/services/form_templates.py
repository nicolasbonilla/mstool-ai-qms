"""
Complete Form Template Definitions — MSTool-AI-QMS.

All 11 regulatory templates with complete field definitions
per IEC 62304, ISO 13485, ISO 14971, IEC 81001-5-1, and EU MDR.
"""

from typing import List, Dict


def get_template_fields(template_id: str) -> List[Dict]:
    """Get all field definitions for a template."""
    templates = {
        "TPL-01": _tpl_01_problem_report,
        "TPL-02": _tpl_02_release_checklist,
        "TPL-03": _tpl_03_code_review,
        "TPL-04": _tpl_04_risk_verification,
        "TPL-05": _tpl_05_design_review,
        "TPL-06": _tpl_06_test_execution,
        "TPL-07": _tpl_07_soup_review,
        "TPL-08": _tpl_08_incident_report,
        "TPL-09": _tpl_09_change_control,
        "TPL-10": _tpl_10_quality_gate,
        "TPL-11": _tpl_11_document_approval,
    }
    fn = templates.get(template_id)
    return fn() if fn else []


def _f(name, label, field_type="text", required=False, options=None, section="General", help_text=""):
    d = {"name": name, "label": label, "field_type": field_type, "required": required, "section": section}
    if options:
        d["options"] = options
    if help_text:
        d["help_text"] = help_text
    return d


def _tpl_01_problem_report():
    return [
        _f("problem_id", "Problem ID", "text", True, section="Identification", help_text="e.g., PR-2026-001"),
        _f("date_reported", "Date Reported", "date", True, section="Identification"),
        _f("reporter_name", "Reporter Name", "text", True, section="Identification"),
        _f("severity", "Severity", "select", True, options=["Critical", "Major", "Minor"], section="Identification"),
        _f("category", "Category", "select", True, options=["Software", "Hardware", "Documentation", "Process"], section="Identification"),
        _f("affected_version", "Affected Version", "text", False, section="Identification"),
        _f("affected_module", "Affected Module", "text", False, section="Identification", help_text="e.g., ai_segmentation_service"),
        _f("affected_requirements", "Affected Requirement IDs", "text", False, section="Identification", help_text="e.g., REQ-FUNC-040, REQ-SAFE-005"),
        _f("description", "Problem Description", "textarea", True, section="Problem Details"),
        _f("steps_to_reproduce", "Steps to Reproduce", "textarea", True, section="Problem Details"),
        _f("expected_behavior", "Expected Behavior", "textarea", True, section="Problem Details"),
        _f("actual_behavior", "Actual Behavior", "textarea", True, section="Problem Details"),
        _f("root_cause", "Root Cause Analysis", "textarea", False, section="Investigation"),
        _f("corrective_action", "Corrective Action", "textarea", False, section="CAPA"),
        _f("preventive_action", "Preventive Action", "textarea", False, section="CAPA"),
        _f("verification_method", "Verification of Correction", "textarea", False, section="Verification"),
        _f("regression_test_results", "Regression Test Results", "textarea", False, section="Verification"),
        _f("disposition", "Disposition", "select", False, options=["Fixed", "Deferred", "Rejected", "Cannot Reproduce"], section="Resolution"),
        _f("resolution_date", "Resolution Date", "date", False, section="Resolution"),
    ]


def _tpl_02_release_checklist():
    return [
        _f("release_version", "Release Version", "text", True, section="Release Info"),
        _f("release_date", "Release Date", "date", True, section="Release Info"),
        _f("release_type", "Release Type", "select", True, options=["Major", "Minor", "Patch", "Hotfix"], section="Release Info"),
        _f("sdp_updated", "SDP Updated", "checkbox", False, section="Deliverables Checklist"),
        _f("srs_updated", "SRS Updated", "checkbox", False, section="Deliverables Checklist"),
        _f("sad_updated", "SAD Updated", "checkbox", False, section="Deliverables Checklist"),
        _f("risk_file_updated", "Risk Management File Updated", "checkbox", False, section="Deliverables Checklist"),
        _f("test_reports_complete", "Test Reports Complete", "checkbox", False, section="Deliverables Checklist"),
        _f("soup_list_current", "SOUP List Current", "checkbox", False, section="Deliverables Checklist"),
        _f("release_notes_written", "Release Notes Written", "checkbox", False, section="Deliverables Checklist"),
        _f("known_anomalies", "Known Anomalies Documented", "checkbox", False, section="Deliverables Checklist"),
        _f("ci_pipeline_passed", "CI Pipeline Passed", "checkbox", False, section="Build Verification"),
        _f("all_tests_pass", "All Tests Pass", "checkbox", False, section="Build Verification"),
        _f("code_coverage_met", "Code Coverage Threshold Met", "checkbox", False, section="Build Verification"),
        _f("no_open_class_c", "No Open Class C Problems", "checkbox", False, section="Regulatory Checklist"),
        _f("risk_controls_verified", "All Risk Controls Verified", "checkbox", False, section="Regulatory Checklist"),
        _f("traceability_complete", "Traceability Matrix Complete", "checkbox", False, section="Regulatory Checklist"),
    ]


def _tpl_03_code_review():
    return [
        _f("review_id", "Review ID", "text", True, section="Review Info"),
        _f("pr_reference", "PR/Commit Reference", "text", True, section="Review Info", help_text="e.g., PR #123 or commit abc1234"),
        _f("module_reviewed", "Module Reviewed", "text", True, section="Review Info"),
        _f("reviewers", "Reviewer(s)", "text", True, section="Review Info"),
        _f("coding_standards", "Coding Standards Compliance", "select", True, options=["Pass", "Fail", "N/A"], section="Code Quality"),
        _f("error_handling", "Error Handling Adequate", "select", True, options=["Pass", "Fail", "N/A"], section="Code Quality"),
        _f("input_validation", "Input Validation Present", "select", True, options=["Pass", "Fail", "N/A"], section="Code Quality"),
        _f("owasp_review", "OWASP Top 10 Security Review", "select", False, options=["Pass", "Fail", "N/A"], section="Security"),
        _f("no_hardcoded_creds", "No Hardcoded Credentials", "select", False, options=["Pass", "Fail", "N/A"], section="Security"),
        _f("proper_logging", "Proper Logging (no PII)", "select", False, options=["Pass", "Fail", "N/A"], section="Security"),
        _f("class_c_review", "Class C Additional Review", "select", False, options=["Pass", "Fail", "N/A"], section="Safety"),
        _f("requirement_traceability", "Requirement Traceability", "select", False, options=["Pass", "Fail", "N/A"], section="Safety"),
        _f("risk_control_impl", "Risk Control Implementation", "select", False, options=["Pass", "Fail", "N/A"], section="Safety"),
        _f("no_memory_leaks", "No Memory Leaks", "select", False, options=["Pass", "Fail", "N/A"], section="Performance"),
        _f("resource_cleanup", "Resource Cleanup", "select", False, options=["Pass", "Fail", "N/A"], section="Performance"),
        _f("issues_found", "Issues Found", "textarea", False, section="Findings"),
        _f("issue_severity", "Issue Severity", "select", False, options=["Critical", "Major", "Minor", "None"], section="Findings"),
        _f("resolution_required", "Resolution Required Before Merge", "select", False, options=["Yes", "No"], section="Findings"),
    ]


def _tpl_04_risk_verification():
    return [
        _f("hazard_id", "Hazard ID", "text", True, section="Hazard", help_text="e.g., HAZ-001"),
        _f("hazard_description", "Hazard Description", "textarea", True, section="Hazard"),
        _f("severity_before", "Severity (Before Control)", "select", True, options=["Catastrophic", "Critical", "Serious", "Minor", "Negligible"], section="Risk Assessment"),
        _f("probability_before", "Probability (Before Control)", "select", True, options=["Frequent", "Probable", "Occasional", "Remote", "Improbable"], section="Risk Assessment"),
        _f("risk_level_before", "Risk Level (Before Control)", "select", True, options=["Unacceptable", "ALARP", "Acceptable"], section="Risk Assessment"),
        _f("control_id", "Risk Control Measure ID", "text", True, section="Control Measure", help_text="e.g., RC-001"),
        _f("control_description", "Control Description", "textarea", True, section="Control Measure"),
        _f("control_type", "Control Type", "select", True, options=["Inherent Safety", "Protective Measure", "Information for Safety"], section="Control Measure"),
        _f("verification_method", "Verification Method", "textarea", True, section="Verification"),
        _f("verification_date", "Verification Date", "date", True, section="Verification"),
        _f("verification_result", "Verification Result", "select", True, options=["PASS", "FAIL", "PARTIAL"], section="Verification"),
        _f("severity_after", "Residual Severity", "select", False, options=["Catastrophic", "Critical", "Serious", "Minor", "Negligible"], section="Residual Risk"),
        _f("probability_after", "Residual Probability", "select", False, options=["Frequent", "Probable", "Occasional", "Remote", "Improbable"], section="Residual Risk"),
        _f("risk_level_after", "Residual Risk Level", "select", False, options=["Unacceptable", "ALARP", "Acceptable"], section="Residual Risk"),
        _f("risk_acceptable", "Risk Acceptable?", "select", True, options=["Yes", "No"], section="Residual Risk"),
        _f("benefit_risk_analysis", "Benefit-Risk Analysis", "textarea", False, section="Residual Risk", help_text="Required if residual risk is not acceptable"),
    ]


def _tpl_05_design_review():
    return [
        _f("review_id", "Review ID", "text", True, section="Review Info"),
        _f("review_date", "Review Date", "date", True, section="Review Info"),
        _f("phase", "Phase", "select", True, options=["Architecture", "Detailed Design", "Implementation"], section="Review Info"),
        _f("participants", "Participants", "textarea", True, section="Review Info", help_text="List all participants with roles"),
        _f("input_documents", "Design Input Documents Reviewed", "textarea", False, section="Documents"),
        _f("output_documents", "Design Output Documents Reviewed", "textarea", False, section="Documents"),
        _f("requirements_coverage", "Requirements Coverage Check", "select", False, options=["Complete", "Partial", "Incomplete"], section="Checks"),
        _f("interface_consistency", "Interface Consistency Check", "select", False, options=["Consistent", "Issues Found", "Not Checked"], section="Checks"),
        _f("safety_addressed", "Safety Requirements Addressed", "select", False, options=["Yes", "Partially", "No"], section="Checks"),
        _f("performance_addressed", "Performance Requirements Addressed", "select", False, options=["Yes", "Partially", "No"], section="Checks"),
        _f("action_items", "Action Items", "textarea", False, section="Outcomes", help_text="List with assignee and due date"),
        _f("review_outcome", "Review Outcome", "select", True, options=["Approved", "Approved with Conditions", "Rejected"], section="Outcomes"),
    ]


def _tpl_06_test_execution():
    return [
        _f("test_run_id", "Test Run ID", "text", True, section="Test Info"),
        _f("test_date", "Date", "date", True, section="Test Info"),
        _f("test_level", "Test Level", "select", True, options=["Unit", "Integration", "System", "Regression"], section="Test Info"),
        _f("tester", "Tester", "text", True, section="Test Info"),
        _f("os", "Operating System", "text", False, section="Environment"),
        _f("python_version", "Python Version", "text", False, section="Environment"),
        _f("node_version", "Node.js Version", "text", False, section="Environment"),
        _f("browser", "Browser", "text", False, section="Environment"),
        _f("test_suite", "Test Suite Executed", "text", False, section="Results"),
        _f("total_tests", "Total Tests", "number", True, section="Results"),
        _f("passed", "Passed", "number", True, section="Results"),
        _f("failed", "Failed", "number", True, section="Results"),
        _f("skipped", "Skipped", "number", False, section="Results"),
        _f("blocked", "Blocked", "number", False, section="Results"),
        _f("failed_details", "Failed Test Details", "textarea", False, section="Failures", help_text="Test name, expected, actual, severity, linked REQ"),
        _f("coverage_statement", "Statement Coverage %", "number", False, section="Coverage"),
        _f("coverage_branch", "Branch Coverage %", "number", False, section="Coverage"),
        _f("coverage_per_module", "Per-Module Breakdown", "textarea", False, section="Coverage"),
        _f("anomalies_found", "Anomalies Found", "textarea", False, section="Anomalies", help_text="Link to TPL-01 if applicable"),
        _f("known_issues_accepted", "Known Issues Accepted", "textarea", False, section="Anomalies"),
    ]


def _tpl_07_soup_review():
    return [
        _f("review_date", "Review Date", "date", True, section="Review Info"),
        _f("reviewer", "Reviewer", "text", True, section="Review Info"),
        _f("sbom_version", "SBOM Version", "text", False, section="Review Info"),
        _f("package_name", "Package Name", "text", True, section="Package Analysis"),
        _f("package_version", "Version", "text", True, section="Package Analysis"),
        _f("license", "License", "text", False, section="Package Analysis"),
        _f("safety_class", "Safety Class", "select", True, options=["A", "B", "C"], section="Package Analysis"),
        _f("purpose", "Purpose in System", "textarea", False, section="Package Analysis"),
        _f("cve_check_date", "CVE Check Date", "date", False, section="Vulnerability Assessment"),
        _f("vulnerabilities_found", "Vulnerabilities Found", "textarea", False, section="Vulnerability Assessment", help_text="CVE IDs with CVSS scores"),
        _f("mitigation", "Mitigation Plan", "textarea", False, section="Vulnerability Assessment"),
        _f("risk_assessment", "Risk Assessment", "textarea", False, section="Risk"),
        _f("acceptable", "Acceptable?", "select", True, options=["Yes", "No", "Conditional"], section="Risk"),
        _f("next_review_date", "Next Review Date", "date", False, section="Follow-up"),
    ]


def _tpl_08_incident_report():
    return [
        _f("incident_id", "Incident ID", "text", True, section="Identification"),
        _f("incident_date", "Date of Incident", "date", True, section="Identification"),
        _f("date_reported", "Date Reported", "date", True, section="Identification"),
        _f("reporter", "Reporter", "text", True, section="Identification"),
        _f("device_udi", "Device UDI", "text", False, section="Device Identification"),
        _f("device_version", "Software Version", "text", False, section="Device Identification"),
        _f("device_config", "Configuration", "text", False, section="Device Identification"),
        _f("description", "Incident Description", "textarea", True, section="Incident Details"),
        _f("patient_impact", "Patient Impact", "textarea", True, section="Incident Details"),
        _f("severity", "Severity", "select", True, options=["Death", "Serious Injury", "Other Serious Public Health Threat", "Near Miss"], section="Incident Details"),
        _f("immediate_actions", "Immediate Corrective Actions", "textarea", True, section="Response"),
        _f("root_cause", "Root Cause Investigation", "textarea", False, section="Investigation"),
        _f("fsca", "FSCA Required?", "select", False, options=["Yes", "No", "Under Investigation"], section="Investigation"),
        _f("fsca_description", "FSCA Description", "textarea", False, section="Investigation"),
        _f("authority_notification_date", "Competent Authority Notification Date", "date", False, section="Regulatory"),
        _f("eudamed_reference", "EUDAMED Reference", "text", False, section="Regulatory"),
        _f("follow_up_actions", "Follow-up Actions", "textarea", False, section="Follow-up"),
        _f("timeline", "Timeline for Resolution", "text", False, section="Follow-up"),
    ]


def _tpl_09_change_control():
    return [
        _f("change_id", "Change Request ID", "text", True, section="Request"),
        _f("change_date", "Date", "date", True, section="Request"),
        _f("requestor", "Requestor", "text", True, section="Request"),
        _f("priority", "Priority", "select", True, options=["Critical", "High", "Medium", "Low"], section="Request"),
        _f("description", "Change Description", "textarea", True, section="Change Details"),
        _f("reason", "Reason for Change", "textarea", True, section="Change Details"),
        _f("affected_modules", "Affected Modules", "textarea", False, section="Change Details"),
        _f("requirements_affected", "Requirements Affected", "textarea", False, section="Impact Analysis"),
        _f("risk_assessment", "Risk Assessment", "textarea", False, section="Impact Analysis"),
        _f("test_impact", "Test Impact", "textarea", False, section="Impact Analysis"),
        _f("documentation_impact", "Documentation Impact", "textarea", False, section="Impact Analysis"),
        _f("safety_related", "Safety-Related?", "select", True, options=["Yes", "No"], section="Classification"),
        _f("regulatory_impact", "Regulatory Impact?", "select", True, options=["Yes", "No"], section="Classification"),
        _f("implementation_plan", "Implementation Plan", "textarea", False, section="Implementation"),
        _f("verification_plan", "Verification Plan", "textarea", False, section="Implementation"),
        _f("verification_results", "Verification Results", "textarea", False, section="Results"),
        _f("regression_results", "Regression Test Results", "textarea", False, section="Results"),
    ]


def _tpl_10_quality_gate():
    return [
        _f("gate_id", "Gate ID", "text", True, section="Gate Info"),
        _f("phase", "Phase", "select", True, options=["Requirements", "Design", "Implementation", "Testing", "Release"], section="Gate Info"),
        _f("gate_date", "Date", "date", True, section="Gate Info"),
        _f("entrance_criteria_met", "Entrance Criteria Met", "textarea", True, section="Criteria"),
        _f("exit_criteria_met", "Exit Criteria Met", "textarea", True, section="Criteria"),
        _f("deliverables_status", "Deliverables Status", "textarea", True, section="Status", help_text="List each deliverable with status"),
        _f("open_action_items", "Open Action Items", "textarea", False, section="Status"),
        _f("open_hazards", "Open Hazards", "textarea", False, section="Risk Status"),
        _f("unmitigated_risks", "Unmitigated Risks", "textarea", False, section="Risk Status"),
        _f("defect_density", "Defect Density", "text", False, section="Quality Metrics"),
        _f("test_coverage", "Test Coverage %", "number", False, section="Quality Metrics"),
        _f("requirement_coverage", "Requirement Coverage %", "number", False, section="Quality Metrics"),
        _f("decision", "Go/No-Go Decision", "select", True, options=["Go", "Conditional Go", "No-Go"], section="Decision"),
        _f("conditions", "Conditions (if Conditional Go)", "textarea", False, section="Decision"),
    ]


def _tpl_11_document_approval():
    return [
        _f("document_id", "Document ID", "text", True, section="Document Info"),
        _f("document_title", "Document Title", "text", True, section="Document Info"),
        _f("document_version", "Version", "text", True, section="Document Info"),
        _f("revision_date", "Revision Date", "date", True, section="Document Info"),
        _f("document_type", "Document Type", "select", True, options=["SDP", "SRS", "SAD", "RMF", "Test Plan", "Test Report", "SOUP List", "Release Notes", "User Manual", "Other"], section="Document Info"),
        _f("applicable_standard", "Applicable Standard", "select", False, options=["IEC 62304", "ISO 13485", "ISO 14971", "IEC 81001-5-1", "EU MDR", "EU AI Act"], section="Document Info"),
        _f("changes_summary", "Changes from Previous Version", "textarea", True, section="Revision"),
        _f("reason_for_revision", "Reason for Revision", "textarea", True, section="Revision"),
        _f("technically_accurate", "Technically Accurate", "select", True, options=["Yes", "No", "N/A"], section="Review Checklist"),
        _f("complete", "Complete", "select", True, options=["Yes", "No", "N/A"], section="Review Checklist"),
        _f("consistent", "Consistent with Other Documents", "select", True, options=["Yes", "No", "N/A"], section="Review Checklist"),
        _f("properly_formatted", "Properly Formatted", "select", True, options=["Yes", "No", "N/A"], section="Review Checklist"),
        _f("distribution_list", "Distribution List", "textarea", False, section="Distribution"),
    ]