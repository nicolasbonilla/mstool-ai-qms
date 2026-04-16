"""
MCP gateway endpoints — JSON-RPC 2.0 envelope over HTTP.

POST /mcp — handles JSON-RPC 2.0 requests:
  {"jsonrpc":"2.0","id":1,"method":"tools/list"}
  {"jsonrpc":"2.0","id":2,"method":"tools/call",
   "params":{"name":"compliance.score","arguments":{}}}

Both responses also write an entry into the WORM ledger so the QMS can
prove who/what queried compliance state via the IDE.
"""

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user, CurrentUser
from app.services.firestore_service import FirestoreService
from app.services.mcp_gateway import list_tools, call_tool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mcp", tags=["MCP Gateway"])


def _jsonrpc_error(req_id: Any, code: int, message: str) -> Dict:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


@router.post("")
async def mcp_dispatch(request: Dict[str, Any],
                         user: CurrentUser = Depends(get_current_user)):
    """JSON-RPC 2.0 dispatcher for MCP-compatible IDE clients."""
    if not isinstance(request, dict) or request.get("jsonrpc") != "2.0":
        raise HTTPException(status_code=400, detail="Expecting JSON-RPC 2.0 envelope")

    method = request.get("method", "")
    req_id = request.get("id")
    params = request.get("params") or {}

    try:
        if method == "tools/list":
            FirestoreService.log_action(
                user_uid=user.uid, user_email=user.email,
                action="mcp_tools_list", resource_type="ai", resource_id="mcp",
                severity="info", details={},
            )
            return {"jsonrpc": "2.0", "id": req_id, "result": list_tools()}

        if method == "tools/call":
            tool_name = params.get("name", "")
            arguments = params.get("arguments") or {}
            try:
                tool_result = call_tool(tool_name, arguments)
            except KeyError as e:
                return _jsonrpc_error(req_id, -32601, str(e))

            FirestoreService.log_action(
                user_uid=user.uid, user_email=user.email,
                action="mcp_tools_call", resource_type="ai", resource_id=tool_name,
                severity="info",
                details={"tool": tool_name, "args": arguments},
            )
            return {"jsonrpc": "2.0", "id": req_id, "result": tool_result}

        return _jsonrpc_error(req_id, -32601, f"Method not found: {method}")
    except Exception as e:
        logger.exception("MCP dispatch failed")
        return _jsonrpc_error(req_id, -32000, f"Internal error: {e}")


@router.get("/tools")
async def list_tools_http(user: CurrentUser = Depends(get_current_user)):
    """Browser-friendly listing of the MCP tools (mirrors tools/list)."""
    return list_tools()
