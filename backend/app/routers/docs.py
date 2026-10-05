import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Document

router = APIRouter(prefix="/api/docs", tags=["docs"])


def _dict(d: Document):
    return {"id": d.id, "title": d.title, "category": d.category, "description": d.description,
            "url": f"/files/docs/{d.filename}"}


@router.get("")
def list_docs(db: Session = Depends(get_db)):
    return [_dict(d) for d in db.scalars(select(Document).order_by(Document.category, Document.title))]


@router.post("")
async def upload(file: UploadFile = File(...), title: str = Form(""), category: str = Form("INNE"),
                 description: str = Form(""), db: Session = Depends(get_db)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Dozwolone są tylko pliki PDF")
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", file.filename)
    dest = settings.docs_dir / safe
    if dest.exists() or db.scalar(select(Document).where(Document.filename == safe)):
        raise HTTPException(409, f"Plik {safe} już istnieje")
    settings.docs_dir.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(await file.read())
    doc = Document(title=title or safe.rsplit(".", 1)[0], category=category.upper() or "INNE",
                   description=description or None, filename=safe)
    db.add(doc)
    db.commit()
    return _dict(doc)


@router.delete("/{doc_id}")
def delete(doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Nie ma takiego dokumentu")
    (settings.docs_dir / doc.filename).unlink(missing_ok=True)
    db.delete(doc)
    db.commit()
    return {"ok": True}
