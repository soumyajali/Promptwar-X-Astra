"""Authority command-centre endpoints. Protected by a demo access code (not production auth)."""
from __future__ import annotations

import hmac

from fastapi import APIRouter, Depends, Header, HTTPException

from .. import config, repository as repo
from ..schemas import Assignment, CategoryCorrection, Login, PriorityOverride, Question, StatusChange, Update, authority_view
from ..services import workflow as wf
from ..services.analytics import dashboard
from ..services.assistant import answer
from ..services.brief import action_brief
from ..services.hotspots import detect_hotspots


def require_authority(x_authority_code: str | None = Header(None)) -> str:
    if not x_authority_code or not hmac.compare_digest(x_authority_code, config.AUTHORITY_CODE):
        raise HTTPException(401, detail={"message": "Authority access code required."})
    return "Ward Officer (demo)"


router = APIRouter(prefix="/api/authority")
protected = APIRouter(prefix="/api/authority", dependencies=[Depends(require_authority)])


@router.post("/login")
def login(body: Login):
    if not hmac.compare_digest(body.code, config.AUTHORITY_CODE):
        raise HTTPException(401, detail={"message": "That access code is not correct."})
    return {"ok": True, "role": "authority", "name": "Ward Officer (demo)"}


@protected.get("/reports")
def list_all():
    return [authority_view(r) for r in repo.list_reports()]


@protected.get("/reports/{rid}")
def detail(rid: str):
    r = repo.get_report(rid)
    if not r:
        raise HTTPException(404, detail={"message": "Report not found."})
    return authority_view(r, detail=True)


def _run(fn, *args, **kwargs):
    try:
        r = fn(*args, **kwargs)
    except LookupError:
        raise HTTPException(404, detail={"message": "Report not found."})
    except wf.WorkflowError as e:
        raise HTTPException(409, detail={"message": str(e)})
    return authority_view(r, detail=True)


@protected.post("/reports/{rid}/status")
def set_status(rid: str, body: StatusChange, actor: str = Depends(require_authority)):
    return _run(wf.change_status, rid, body.status, actor=actor, public_message=body.public_message,
                resolution_note=body.resolution_note)


@protected.post("/reports/{rid}/assign")
def set_assignment(rid: str, body: Assignment, actor: str = Depends(require_authority)):
    return _run(wf.assign, rid, body.department, body.officer or None, actor=actor)


@protected.post("/reports/{rid}/category")
def set_category(rid: str, body: CategoryCorrection, actor: str = Depends(require_authority)):
    return _run(wf.correct_category, rid, body.category, actor=actor, reason=body.reason)


@protected.post("/reports/{rid}/priority")
def set_priority(rid: str, body: PriorityOverride, actor: str = Depends(require_authority)):
    return _run(wf.override_priority, rid, body.level, body.reason, actor=actor)


@protected.post("/reports/{rid}/updates")
def add_update(rid: str, body: Update, actor: str = Depends(require_authority)):
    return _run(wf.add_update, rid, body.message, body.visibility, actor=actor)


@protected.get("/dashboard")
def get_dashboard():
    return dashboard(repo.list_reports())


@protected.get("/hotspots")
def hotspots():
    return detect_hotspots(repo.list_reports())


@protected.get("/brief")
def brief(ward: str | None = None):
    return action_brief(repo.list_reports(), ward or None)


@protected.post("/assistant")
def assistant(body: Question):
    return answer(body.question)


@protected.post("/demo/reset")
def reset_demo():
    from ..seed import seed

    n = seed(force=True)
    return {"ok": True, "reports": n}
