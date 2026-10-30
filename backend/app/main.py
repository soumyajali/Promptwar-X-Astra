"""CivicPulse AI — FastAPI application entry point."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import config, db
from .events import broker
from .routers import authority, public

log = logging.getLogger("civicpulse")


@asynccontextmanager
async def lifespan(app: FastAPI):
    broker.bind_loop(asyncio.get_running_loop())
    db.get_conn()
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    if config.AUTO_SEED:
        from .seed import seed

        n = seed()
        if n:
            log.warning("Seeded %d synthetic demo reports", n)
    yield


app = FastAPI(title="CivicPulse AI", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.ALLOWED_ORIGINS, allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    fields = {}
    for e in exc.errors():
        loc = [str(x) for x in e["loc"] if x not in ("body", "form", "query")]
        fields[".".join(loc) or "request"] = e["msg"].replace("Value error, ", "")
    return JSONResponse(status_code=422, content={"detail": {"message": "Some fields are invalid.", "fields": fields}})


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": {"message": "Something went wrong on the server. Please try again."}})


@app.get("/api/health")
def health():
    count = db.query("SELECT COUNT(*) AS n FROM reports")[0]["n"]
    from .services import llm

    return {"ok": True, "reports": count, "sse_clients": broker.subscriber_count,
            "assistant_engine": "claude + local fallback" if llm.enabled() else "local (no ANTHROPIC_API_KEY set)"}


@app.get("/api/events")
async def events(request: Request):
    queue = broker.subscribe()

    async def stream():
        try:
            yield f"event: hello\ndata: {{\"version\": {broker.version}}}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=20)
                    yield f"event: change\ndata: {msg}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            broker.unsubscribe(queue)

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


app.include_router(public.router)
app.include_router(authority.router)
app.include_router(authority.protected)
config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=config.UPLOAD_DIR), name="uploads")

# Serve the built frontend (single-process mode) when it exists.
if config.FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=config.FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        f = config.FRONTEND_DIST / path
        if path and f.is_file() and config.FRONTEND_DIST in f.resolve().parents:
            return FileResponse(f)
        return FileResponse(config.FRONTEND_DIST / "index.html")
