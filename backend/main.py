import logging
import os
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from auth import _jwt_secret
from db import create_all
from routers import auth as auth_router
from routers import comments as comments_router
from routers import dashboard as dashboard_router
from routers import export as export_router
from routers import tickets as tickets_router
from routers import users as users_router

_EMAIL_RE = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")


class RedactPIIFilter(logging.Filter):
    """Strips e-mail addresses (and anything shaped like one) from log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:
            return True
        record.msg = _EMAIL_RE.sub("[EMAIL]", message)
        record.args = ()
        return True


def _configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.addFilter(RedactPIIFilter())
    logging.basicConfig(level=logging.INFO, handlers=[handler])


def _cors_origins() -> list[str]:
    raw = os.environ.get("BACKEND_CORS_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    _configure_logging()
    _jwt_secret()
    create_all()
    yield


app = FastAPI(title="Enterprise Helpdesk", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    logging.getLogger("app").info(
        "HTTP %s %s -> %s", request.method, request.url.path, exc.status_code
    )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    logging.getLogger("app").info("validation error on %s %s", request.method, request.url.path)
    errors = [
        {"loc": err.get("loc", []), "msg": err.get("msg", ""), "type": err.get("type", "")}
        for err in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logging.getLogger("app").error(
        "unhandled %s %s %s", request.method, request.url.path, type(exc).__name__
    )
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(dashboard_router.router)
app.include_router(export_router.router)
app.include_router(tickets_router.router)
app.include_router(comments_router.router)
