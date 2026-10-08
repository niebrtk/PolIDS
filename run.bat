@echo off
REM Uruchomienie PolIDS na Windows. Pierwsze uruchomienie tworzy srodowisko .venv i instaluje biblioteki.
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
    echo Tworze srodowisko .venv ...
    py -3 -m venv .venv 2>nul || python -m venv .venv
)
if not exist .venv\Scripts\python.exe (
    echo BLAD: nie znaleziono Pythona. Zainstaluj Python 3.11+ z python.org i zaznacz "Add python.exe to PATH".
    pause
    exit /b 1
)
call .venv\Scripts\activate.bat
echo Instaluje biblioteki ...
python -m pip install --upgrade pip >nul
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo BLAD instalacji bibliotek - sprawdz komunikaty powyzej.
    pause
    exit /b 1
)
REM Przegladarka otworzy sie dopiero, gdy serwer odpowie (pierwszy start buduje baze, to trwa chwile).
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 300;$i++){try{Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/config -TimeoutSec 2 | Out-Null; Start-Process 'http://127.0.0.1:8000'; break}catch{Start-Sleep 1}}"
echo Uruchamiam serwer na http://127.0.0.1:8000 (zamknij to okno, zeby zatrzymac).
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir backend
pause
