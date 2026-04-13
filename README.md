# MSTool-AI-QMS

AI-powered regulatory compliance automation platform for medical device software.

## Purpose

MSTool-AI-QMS is a **separate companion application** that monitors and analyzes the [MSTool-AI](https://github.com/nicolasbonilla/medical-imaging-viewer) medical device software for regulatory compliance. It does NOT modify the medical device code.

## Features

- **Compliance Dashboard** — Real-time scoring (IEC 62304, ISO 13485, Cybersecurity, CE Mark)
- **Form Manager** — Digital versions of 11 audit templates (TPL-01 to TPL-11) with AI auto-fill
- **Traceability Explorer** — Interactive graph: Requirements -> Design -> Code -> Tests -> Risk Controls
- **Audit Simulator** — AI-powered Notified Body audit preparation
- **SOUP Monitor** — CVE vulnerability scanning + CycloneDX SBOM management
- **Document Sync** — Detect drift between code changes and regulatory documentation

## Architecture

```
mstool-ai-qms/
  backend/          FastAPI (Python 3.11) on port 8010
    app/
      api/routes/    compliance.py, forms.py
      services/      compliance_service.py
      models/        schemas.py
      mcp/           MCP servers (ports 8006-8008)
      agents/        AI agents (Claude API)
    tests/
  frontend/         React + Vite + TypeScript + Tailwind on port 5174
    src/
      pages/         Dashboard, Forms, Traceability, Audit, SOUP, DocSync
      api/           API clients
```

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
# Set MSTOOL_AI_REPO_PATH in .env to point to your MSTool-AI repo
uvicorn app.main:app --port 8010 --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Standards Monitored

- IEC 62304:2006+A1:2015
- ISO 13485:2016
- IEC 81001-5-1:2021
- EU MDR 2017/745
- EU AI Act 2024/1689
