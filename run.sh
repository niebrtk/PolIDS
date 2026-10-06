#!/usr/bin/env bash
# Uruchomienie vPANDORA na macOS/Linux: bash run.sh
# Pierwsze uruchomienie tworzy srodowisko .venv i instaluje biblioteki.
set -e
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
    echo "BLAD: nie znaleziono Pythona. Zainstaluj Python 3.11+ z python.org."
    exit 1
fi
[ -x .venv/bin/python ] || { echo "Tworze srodowisko .venv ..."; python3 -m venv .venv; }
. .venv/bin/activate
echo "Instaluje biblioteki ..."
python -m pip install -q --upgrade pip
python -m pip install -q -r requirements.txt
# Przegladarka otworzy sie dopiero, gdy serwer odpowie (pierwszy start buduje baze, to trwa chwile).
(
    for _ in $(seq 1 300); do
        if curl -fs -o /dev/null --max-time 2 http://127.0.0.1:8000/api/config; then
            if [ "$(uname)" = "Darwin" ]; then open http://127.0.0.1:8000
            elif command -v xdg-open >/dev/null 2>&1; then xdg-open http://127.0.0.1:8000 >/dev/null 2>&1
            fi
            break
        fi
        sleep 1
    done
) &
echo "Uruchamiam serwer na http://127.0.0.1:8000 (Ctrl+C zatrzymuje)."
exec python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir backend
