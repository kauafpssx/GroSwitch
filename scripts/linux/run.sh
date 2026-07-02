#!/usr/bin/env bash
#
# GroSwitch - Linux Run Script
# =============================
# Starts both the backend API server and frontend dev server.
#
# Usage:
#   ./scripts/linux/run.sh          # Start in development mode
#   ./scripts/linux/run.sh --prod   # Start in production mode
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

# ──────────────────────────────────────────────
# Check prerequisites
# ──────────────────────────────────────────────
command -v bun &>/dev/null || fail "Bun is not installed. Run scripts/linux/install.sh first."

if [ ! -f ".env" ]; then
  fail ".env file not found. Run scripts/linux/install.sh first or create .env from .env.example."
fi

# ──────────────────────────────────────────────
# Parse mode
# ──────────────────────────────────────────────
MODE="${1:-dev}"

if [ "$MODE" = "--prod" ] || [ "$MODE" = "prod" ]; then
  info "Starting in PRODUCTION mode (single port)..."
  info "Building all packages and starting server on port ${PORT:-8400}..."
  echo ""
  exec bun run start
else
  info "Starting in DEVELOPMENT mode (two ports)..."
  info "  Backend API → http://localhost:${PORT:-8400}"
  info "  Frontend UI  → http://localhost:5173  (proxies API calls to backend)"
  echo ""
  bun run dev
fi
