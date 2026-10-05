@echo off
REM Uruchomienie vPANDORA na Windows. Pierwsze uruchomienie tworzy srodowisko .venv i instaluje biblioteki.
cd /d "%~dp0"
if not exist .venv (
    echo Tworze srodowisko .venv ...
    py -3 -m venv .venv || python -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip >nul
python -m pip install -r requirements.txt
start "" http://127.0.0.1:8000
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir backend
