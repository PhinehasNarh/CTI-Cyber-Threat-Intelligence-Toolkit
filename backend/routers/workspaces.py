"""Workspace (multi-tenant) management and the active-workspace dependency (#34).

The frontend sends the active workspace id in the `X-Workspace-Id` header. Scoped
list endpoints (IOCs, articles, dashboard) filter by it. Feed ingestion populates
the Default workspace (id=1).
"""

import re

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Workspace, IOC, FeedArticle

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


def active_workspace(x_workspace_id: str | None = Header(default=None)) -> int:
    """Resolve the active workspace id from the request header (defaults to 1)."""
    try:
        return int(x_workspace_id) if x_workspace_id else 1
    except ValueError:
        return 1


class WorkspaceCreate(BaseModel):
    name: str
    description: str = ""


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "workspace"


@router.get("")
async def list_workspaces(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Workspace).order_by(Workspace.id))).scalars().all()
    out = []
    for w in rows:
        iocs = (await db.execute(select(func.count(IOC.id)).where(IOC.workspace_id == w.id))).scalar() or 0
        arts = (await db.execute(select(func.count(FeedArticle.id)).where(FeedArticle.workspace_id == w.id))).scalar() or 0
        out.append({
            "id": w.id, "name": w.name, "slug": w.slug, "description": w.description,
            "is_default": w.id == 1, "ioc_count": iocs, "article_count": arts,
        })
    return {"count": len(out), "workspaces": out}


@router.post("")
async def create_workspace(body: WorkspaceCreate, db: AsyncSession = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
    slug = _slugify(name)
    existing = (await db.execute(select(Workspace).where((Workspace.name == name) | (Workspace.slug == slug)))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Workspace with that name already exists")
    w = Workspace(name=name, slug=slug, description=body.description or None)
    db.add(w)
    await db.commit()
    await db.refresh(w)
    return {"id": w.id, "name": w.name, "slug": w.slug, "description": w.description, "is_default": False}


@router.delete("/{workspace_id}")
async def delete_workspace(workspace_id: int, db: AsyncSession = Depends(get_db)):
    if workspace_id == 1:
        raise HTTPException(status_code=400, detail="Cannot delete the Default workspace")
    w = (await db.execute(select(Workspace).where(Workspace.id == workspace_id))).scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Workspace not found")
    # Reassign any data back to Default so nothing is orphaned
    await db.execute(IOC.__table__.update().where(IOC.workspace_id == workspace_id).values(workspace_id=1))
    await db.execute(FeedArticle.__table__.update().where(FeedArticle.workspace_id == workspace_id).values(workspace_id=1))
    await db.delete(w)
    await db.commit()
    return {"deleted": workspace_id, "data_reassigned_to": 1}
