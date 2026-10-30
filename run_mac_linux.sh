#!/usr/bin/env bash
# GSTiQ - starts the Python engine and opens the app in the browser
cd "$(dirname "$0")"
python3 -m pip install --quiet -r requirements.txt || { echo "Install Python 3.10+ or open OPEN_ME_GSTiQ_App.html directly."; exit 1; }
( sleep 4; (command -v open >/dev/null && open http://127.0.0.1:5000) || xdg-open http://127.0.0.1:5000 ) >/dev/null 2>&1 &
python3 backend/app.py
