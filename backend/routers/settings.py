"""API routes for application settings and log viewing."""

from pathlib import Path
from fastapi import APIRouter, Query
from config import get_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])

LOG_DIR = Path(__file__).parent.parent / "logs"


@router.get("")
async def get_current_settings():
    """Get current settings (masks API keys for security)."""
    s = get_settings()

    def mask(key: str) -> dict:
        if not key:
            return {"configured": False, "value": ""}
        return {"configured": True, "value": key[:4] + "****" + key[-4:] if len(key) > 8 else "****"}

    return {
        "api_keys": {
            "virustotal": mask(s.virustotal_api_key),
            "abuseipdb": mask(s.abuseipdb_api_key),
            "shodan": mask(s.shodan_api_key),
            "greynoise": mask(s.greynoise_api_key),
            "otx": mask(s.otx_api_key),
        },
        "feed_poll_interval": s.feed_poll_interval,
    }


@router.get("/logs")
async def get_logs(
    file: str = Query(default="cti-platform", description="Log file: cti-platform or access"),
    lines: int = Query(default=200, le=2000, ge=10),
    search: str | None = None,
):
    """Read recent log entries. Returns last N lines, optionally filtered."""
    safe_name = "access" if file == "access" else "cti-platform"
    log_path = LOG_DIR / f"{safe_name}.log"

    if not log_path.exists():
        return {"file": safe_name, "lines": [], "total": 0}

    with open(log_path, "r", encoding="utf-8", errors="replace") as f:
        all_lines = f.readlines()

    # Filter if search term provided
    if search:
        search_lower = search.lower()
        all_lines = [l for l in all_lines if search_lower in l.lower()]

    # Return the last N lines
    tail = all_lines[-lines:]
    return {
        "file": safe_name,
        "lines": [l.rstrip("\n") for l in tail],
        "total": len(all_lines),
    }


@router.get("/logs/files")
async def list_log_files():
    """List available log files with sizes."""
    if not LOG_DIR.exists():
        return {"files": []}

    files = []
    for p in sorted(LOG_DIR.iterdir()):
        if p.is_file() and p.suffix in (".log", ""):
            files.append({
                "name": p.name,
                "size_kb": round(p.stat().st_size / 1024, 1),
                "modified": p.stat().st_mtime,
            })
    return {"files": files}
