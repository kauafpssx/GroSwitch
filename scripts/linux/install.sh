#!/usr/bin/env bash
#
# GroSwitch - Linux Installation Script
# ======================================
# This script installs all dependencies and initializes the project
# for running on Linux / Ubuntu Server.
#
# Usage:
#   chmod +x scripts/linux/install.sh
#   ./scripts/linux/install.sh
#

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

# ──────────────────────────────────────────────
# Colors for output
# ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $1"; exit 1; }

# ──────────────────────────────────────────────
# 1. Check OS / Architecture
# ──────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

info "Detected OS: $OS, Architecture: $ARCH"

if [ "$OS" != "Linux" ]; then
  warn "This script is optimized for Linux. Detected OS: $OS"
fi

# ──────────────────────────────────────────────
# 2. Check for required tools
# ──────────────────────────────────────────────
info "Checking prerequisites..."

# Bun
if command -v bun &>/dev/null; then
  BUN_VERSION="$(bun --version)"
  ok "Bun v$BUN_VERSION is installed"
else
  info "Bun is not installed. Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  # Source the updated PATH
  if [ -f "$HOME/.bashrc" ]; then
    # shellcheck disable=SC1091
    source "$HOME/.bashrc"
  fi
  if [ -f "$HOME/.profile" ]; then
    # shellcheck disable=SC1091
    source "$HOME/.profile"
  fi
  # Add to current session PATH
  export PATH="$HOME/.bun/bin:$PATH"
  if command -v bun &>/dev/null; then
    ok "Bun v$(bun --version) installed successfully"
  else
    fail "Failed to install Bun. Please install it manually: https://bun.sh"
  fi
fi

# git
if ! command -v git &>/dev/null; then
  info "Git is not installed. Installing..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y -qq git
  elif command -v yum &>/dev/null; then
    sudo yum install -y git
  elif command -v apk &>/dev/null; then
    apk add git
  else
    fail "Could not install git. Please install it manually and re-run this script."
  fi
  ok "Git installed successfully"
fi

# ──────────────────────────────────────────────
# 3. Install project dependencies
# ──────────────────────────────────────────────
info "Installing project dependencies with Bun..."
bun install
ok "Dependencies installed"

# ──────────────────────────────────────────────
# 4. Set up environment file
# ──────────────────────────────────────────────
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    warn ".env file created from .env.example"
    warn ">>> Please edit .env and set your MASTER_API_KEY and MASTER_ENCRYPTION_KEY <<<"
  else
    warn ".env.example not found. Creating a minimal .env file..."
    cat > .env << 'EOF'
MASTER_API_KEY=change-me-to-a-secret-key
MASTER_ENCRYPTION_KEY=change-me-to-at-least-32-chars!!
PORT=8400
# Prisma resolves file: paths relative to apps/backend/prisma/,
# so ../../../dev.db points to the repo root.
DATABASE_URL=file:../../../dev.db
GROQ_BASE_URL=https://api.groq.com/openai/v1
KEY_MONITOR_INTERVAL_MS=60000
EOF
    warn ">>> Please edit .env and set your MASTER_API_KEY and MASTER_ENCRYPTION_KEY <<<"
  fi
else
  ok ".env file already exists"
fi

# ──────────────────────────────────────────────
# 5. Create .env for Prisma (needed in apps/backend/ for db push)
# ──────────────────────────────────────────────
mkdir -p apps/backend
# Always regenerate apps/backend/.env – it's auto-generated content that
# must match the schema location. The root .env (with user credentials)
# is never overwritten.
cat > apps/backend/.env << 'EOF'
# Prisma resolves file: paths relative to prisma/schema.prisma, so
# ../../../dev.db points to the repo root (same as the server uses).
DATABASE_URL=file:../../../dev.db
EOF
info "Created apps/backend/.env for Prisma"

# ──────────────────────────────────────────────
# 6. Generate Prisma client and push schema
# ──────────────────────────────────────────────
info "Generating Prisma client..."
bun run db:generate
ok "Prisma client generated"

info "Pushing database schema..."
bun run db:push
ok "Database schema pushed"

# ──────────────────────────────────────────────
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  GroSwitch installation complete! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Next steps:"
echo "    1. Edit .env with your credentials if you haven't already"
echo "    2. Make sure the frontend dist/ folder exists (build on your local machine)"
echo "    3. Run the server:  ./scripts/linux/run.sh"
echo "    4. Open http://localhost:8400 in your browser"
echo ""
