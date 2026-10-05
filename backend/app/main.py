import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .importers.seed import init_db
from .routers import aerodromes, aircraft, callsigns, docs, meteo, nav, notam, system, vatsim

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="vPANDORA API", version="0.4.0", lifespan=lifespan,
              description="API dla aplikacji vPANDORA (VATSIM PL vACC). Dokumentacja interaktywna: /docs")

for r in (system, meteo, aerodromes, notam, aircraft, callsigns, nav, vatsim, docs):
    app.include_router(r.router)

settings.docs_dir.mkdir(parents=True, exist_ok=True)
settings.photos_dir.mkdir(parents=True, exist_ok=True)
app.mount("/files/docs", StaticFiles(directory=settings.docs_dir), name="docs-files")
app.mount("/files/photos", StaticFiles(directory=settings.photos_dir), name="photo-files")
app.mount("/static", StaticFiles(directory=settings.frontend_dir), name="static")


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(settings.frontend_dir / "index.html")
