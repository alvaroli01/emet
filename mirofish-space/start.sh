#!/bin/sh
# Starts MiroFish exactly as `npm run backend` + the built frontend, with the emet gate in front on the Space port.
set -e
cd "$HOME/app"
python3 "$HOME/sync.py" restore
python3 "$HOME/sync.py" watch &
(cd backend && uv run --frozen python run.py) &
(cd frontend && npx vite preview --host 127.0.0.1 --port 3000 --strictPort) &
exec node "$HOME/gate.mjs"
