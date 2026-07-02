#!/usr/bin/env bash
#
# GroSwitch - Linux Run Script
# =============================
# Starts the GroSwitch server from source (no build required).
#
# On Alwaysdata and similar servers, Bun's PATH may not be persisted,
# so we use the absolute path ~/.bun/bin/bun.
#
# Usage:
#   ./scripts/linux/run.sh          # Production mode (single port)
#   ./scripts/linux/run.sh --dev    # Development mode (two ports)
#

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $1"; exit 1; }

# Use absolute path to Bun (servers like Alwaysdata don't persist env vars)
BUN="$HOME/.bun/bin/bun"
if [ ! -x "$BUN" ]; then
  # Fallback: try bun from PATH
  BUN="$(command -v bun 2>/dev/null || true)"
  if [ -z "$BUN" ]; then
    fail "Bun is not installed. Run scripts/linux/install.sh first."
  fi
fi

if [ ! -f ".env" ]; then
  fail ".env file not found. Run scripts/linux/install.sh first or create .env from .env.example."
fi

if [ ! -d "apps/frontend/dist" ] || [ ! -f "apps/frontend/dist/index.html" ]; then
  warn "Frontend dist/ not found. The API will work but the dashboard UI won't be served."
  warn "Build the frontend on your local machine and push to git, then pull here."
fi

# ──────────────────────────────────────────────
# Parse mode
# ──────────────────────────────────────────────
MODE="${1:-prod}"

if [ "$MODE" = "--dev" ] || [ "$MODE" = "dev" ]; then
  info "Starting in DEVELOPMENT mode (two ports)..."
  info "  Backend API → http://localhost:${PORT:-8400}"
  info "  Frontend UI  → http://localhost:5173  (requires Vite dev server)"
  echo ""
  exec "$BUN" run dev
fi

# ──────────────────────────────────────────────
# Production mode — run backend from source
# ──────────────────────────────────────────────
info "Starting GroSwitch from source on port ${PORT:-8400}..."
info "  Frontend will be served from apps/frontend/dist/ if present"
echo ""

exec "$BUN" run apps/backend/src/server.ts
