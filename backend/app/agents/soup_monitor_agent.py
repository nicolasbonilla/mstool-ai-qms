"""
SOUP Monitor Agent — Haiku 4.5.

Trigger: cron daily 2am, or on-demand.
Goal: Scan current dependencies against live vulnerability feeds and
produce a context-aware impact assessment per vulnerability (NOT just
"does package X appear in the advisory?").

Differentiation: existing SOUPService.scan_vulnerabilities() reports
CVEs by keyword match. This agent layers Claude reasoning on top:
which class of our modules uses the vulnerable dependency, which
clinical pathways could be affected, whether we have an existing
mitigation.
"""

from typing import Dict

from app.agents.base_agent import BaseAgent, AgentResult, Citation, get_anthropic_client
from app.services.soup_service import SOUPService


class SOUPMonitorAgent(BaseAgent):
    name = "soup_monitor"
    description = "Analyzes current dependencies against CVE feeds with clinical context"
    tier = "haiku"
    default_requires_signoff = False  # informational
    system_prompt = (
        "You are the SOUP Monitor Agent for MSTool-AI-QMS. SOUP = Software of "
        "Unknown Provenance per IEC 62304 §8.1.2. For each vulnerability "
        "provided, write a one-paragraph IMPACT ASSESSMENT that explicitly "
        "notes:\n"
        "- the dependency's safety class (A/B/C) under IEC 62304\n"
        "- whether the CVE is exploitable given how the package is used\n"
        "- recommended action (upgrade / no-op / monitor)\n\n"
        "Respond in JSON:\n"
        '{\n'
        '  "summary": "one-line overview",\n'
        '  "findings": [\n'
        '    {"cve_id":"CVE-2024-...", "package":"...", "safety_class":"B", '
        '"exploitable":true, "action":"upgrade", "impact":"..."}\n'
        '  ]\n'
        '}'
    )

    def _run(self, context: Dict) -> AgentResult:
        client = get_anthropic_client()
        svc = SOUPService()

        scan = svc.scan_vulnerabilities()
        vulns = scan.get("vulnerabilities", [])

        if not vulns:
            return AgentResult(
                summary="No vulnerabilities found across scanned dependencies.",
                confidence=1.0,
                requires_human_signoff=False,
            )

        # Enrich with our safety classifications
        deps = {d["name"]: d for d in svc.get_all_dependencies()}

        enriched = []
        for v in vulns[:15]:
            pkg = v.get("package", "")
            meta = deps.get(pkg, {})
            enriched.append({
                "cve_id": v.get("cve_id"),
                "package": pkg,
                "severity": v.get("severity"),
                "cvss_score": v.get("cvss_score"),
                "description": v.get("description"),
                "safety_class": meta.get("safety_class", "?"),
                "source": meta.get("source", "?"),
                "version": v.get("version"),
            })

        if client is None:
            return AgentResult(
                summary=f"{len(enriched)} CVEs found (AI stub — configure ANTHROPIC_API_KEY for impact analysis)",
                findings=enriched,
                citations=[Citation(source="cve", reference=v["cve_id"],
                                    url=f"https://nvd.nist.gov/vuln/detail/{v['cve_id']}")
                           for v in enriched],
                confidence=0.3,
                requires_human_signoff=False,
            )

        import json
        from app.agents.traceability_agent import _extract_json  # reuse helper

        user_prompt = "Vulnerabilities with our context:\n" + json.dumps(enriched, indent=2)
        message = client.messages.create(
            model=self.model_id,
            max_tokens=3000,
            system=self.system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = message.content[0].text if message.content else "{}"
        try:
            parsed = json.loads(_extract_json(raw))
        except Exception:
            parsed = {"summary": "Parse failed", "findings": enriched}

        return AgentResult(
            summary=parsed.get("summary", ""),
            findings=parsed.get("findings", []),
            citations=[
                Citation(source="cve", reference=v["cve_id"],
                         url=f"https://nvd.nist.gov/vuln/detail/{v['cve_id']}")
                for v in enriched
            ],
            confidence=0.7,
            requires_human_signoff=False,
            raw=raw,
            usage={
                "input_tokens": getattr(message.usage, "input_tokens", 0),
                "output_tokens": getattr(message.usage, "output_tokens", 0),
            },
        )
