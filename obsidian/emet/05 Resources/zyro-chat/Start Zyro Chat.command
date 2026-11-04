#!/bin/bash
# Double-click to run the Zyro Chat site locally.
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin:$PATH"
if command -v npm >/dev/null 2>&1; then
  echo "▶ Node $(node -v) found — installing dependencies (first run only)…"
  [ -d node_modules ] || npm install
  echo "▶ Starting dev server — your browser will open at http://localhost:5173"
  echo "  (Keep this window open. Press Ctrl+C to stop.)"
  npm run dev -- --open
else
  echo "Node.js isn't installed, opening the standalone version instead."
  echo "(Install Node from https://nodejs.org to run the full dev server.)"
  open "Open Zyro Chat.html"
fi
