#!/usr/bin/env bash
#
# GroSwitch - Linux / Ubuntu Server Validation Script
# ====================================================
# Checks whether the current environment is properly set up to run
# the GroSwitch gateway on a Linux (Ubuntu/Debian/CentOS/Alpine) server.
#
# Usage:
#   ./scripts/linux/validate.sh
#

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass() { PASS=$((PASS + 1)); echo -e "${GREEN}[PASS]${NC}  $1"; }
fail() { FAIL=$((FAIL + 1)); echo -e "${RED}[FAIL]${NC}  $1"; }
warn() { WARN=$((WARN + 1)); echo -e "${YELLOW}[WARN]${NC}  $1"; }
header() { echo -e "\n${CYAN}── $1 ──${NC}"; }

echo ""
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo -e "${CYAN}  GroSwitch - Environment Validation${NC}"
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo ""

# ──────────────────────────────────────────────
# 1. Operating System
# ──────────────────────────────────────────────
header "Operating System"

OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" = "Linux" ]; then
  pass "OS: Linux ($(uname -r))"

  # Detect distro
  if command -v lsb_release &>/dev/null; then
    DISTRO="$(lsb_release -ds 2>/dev/null || true)"
    pass "Distribution: $DISTRO"
  elif [ -f /etc/os-release ]; then
    DISTRO="$(awk -F= '/^PRETTY_NAME=/ {print $2}' /etc/os-release 2>/dev/null | tr -d '"' || true)"
    pass "Distribution: $DISTRO"
  else
    warn "Could not detect Linux distribution"
  fi

  # Check if systemd is available (good for production)
  if command -v systemctl &>/dev/null; then
    pass "systemd available (can run as a service)"
  else
    warn "systemd not found — you may need a process manager like screen/tmux/supervisord"
  fi

  # Ubuntu / Debian specific checks
  if command -v apt-get &>/dev/null; then
    pass "apt package manager available (Ubuntu/Debian)"
  elif command -v yum &>/dev/null; then
    pass "yum package manager available (RHEL/CentOS)"
  elif command -v apk &>/dev/null; then
    pass "apk package manager available (Alpine)"
  else
    warn "Could not detect a supported package manager"
  fi

  # Check for common missing build tools on Ubuntu
  if command -v apt-get &>/dev/null; then
    MISSING_BUILD=""
    command -v gcc &>/dev/null || MISSING_BUILD="$MISSING_BUILD build-essential"
    command -v make &>/dev/null || MISSING_BUILD="$MISSING_BUILD make"
    command -v python3 &>/dev/null || MISSING_BUILD="$MISSING_BUILD python3"
    if [ -n "$MISSING_BUILD" ]; then
      warn "Some build tools may be missing. Install with: sudo apt-get install$MISSING_BUILD"
    else
      pass "Common build tools are installed"
    fi
  fi
else
  warn "OS: $OS (not Linux — some checks may be skipped)"
fi

if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  pass "Architecture: $ARCH (Bun supported)"
else
  warn "Architecture: $ARCH — Bun may not have official support"
fi

# ──────────────────────────────────────────────
# 2. Required Tools
# ──────────────────────────────────────────────
header "Required Tools"

# Bun
if command -v bun &>/dev/null; then
  BUN_VER="$(bun --version)"
  pass "Bun v$BUN_VER"

  # Extract major version
  BUN_MAJOR="${BUN_VER%%.*}"
  if [ "$BUN_MAJOR" -ge 1 ] 2>/dev/null; then
    pass "  └ Bun version >= 1.x (required)"
  else
    fail "  └ Bun version must be >= 1.x (found v$BUN_VER)"
  fi
else
  fail "Bun is not installed (required: https://bun.sh)"
fi

# Git
if command -v git &>/dev/null; then
  GIT_VER="$(git --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
  pass "Git $GIT_VER"
else
  fail "Git is not installed"
fi

# ──────────────────────────────────────────────
# 3. Project Structure
# ──────────────────────────────────────────────
header "Project Structure"

[ -f "package.json" ]       && pass "package.json found"       || fail "package.json missing"
[ -f "bun.lock" ]           && pass "bun.lock found"           || warn "bun.lock not found (run 'bun install')"
[ -d "node_modules" ]       && pass "node_modules exists"      || fail "node_modules missing (run 'bun install')"
[ -f "config.yml" ]         && pass "config.yml found"         || fail "config.yml missing"
[ -f ".env.example" ]       && pass ".env.example found"       || warn ".env.example missing"

# Check workspaces
[ -d "apps/backend" ]       && pass "apps/backend found"       || fail "apps/backend missing"
[ -d "apps/frontend" ]      && pass "apps/frontend found"      || fail "apps/frontend missing"
[ -d "packages/common" ]    && pass "packages/common found"    || fail "packages/common missing"

# Check Prisma schema
[ -f "apps/backend/prisma/schema.prisma" ] && pass "Prisma schema found" || fail "Prisma schema missing"

# ──────────────────────────────────────────────
# 4. Prisma Client
# ──────────────────────────────────────────────
header "Prisma Client"

if [ -d "node_modules/@prisma/client" ]; then
  pass "@prisma/client installed"
else
  fail "@prisma/client not installed (run 'bun run db:generate')"
fi

# ──────────────────────────────────────────────
# 5. Environment Variables
# ──────────────────────────────────────────────
header "Environment Variables"

if [ -f ".env" ]; then
  pass ".env file exists"

  # Check required variables
  MISSING_ENV=0

  if grep -q '^MASTER_API_KEY=' .env 2>/dev/null; then
    VAL="$(grep '^MASTER_API_KEY=' .env | cut -d= -f2-)"
    if [ -z "$VAL" ] || [ "$VAL" = "your-master-api-key-here" ] || [ "$VAL" = "change-me-to-a-secret-key" ]; then
      warn "MASTER_API_KEY is set but appears to be a placeholder — update it!"
    else
      pass "MASTER_API_KEY is set"
    fi
  else
    fail "MASTER_API_KEY is missing from .env"
    MISSING_ENV=1
  fi

  if grep -q '^MASTER_ENCRYPTION_KEY=' .env 2>/dev/null; then
    VAL="$(grep '^MASTER_ENCRYPTION_KEY=' .env | cut -d= -f2-)"
    if [ -z "$VAL" ] || [ "$VAL" = "your-encryption-key-here-min-32-chars" ] || [ "$VAL" = "change-me-to-at-least-32-chars!!" ]; then
      warn "MASTER_ENCRYPTION_KEY is set but appears to be a placeholder — update it!"
    elif [ "${#VAL}" -lt 32 ]; then
      fail "MASTER_ENCRYPTION_KEY is too short (${#VAL} chars, minimum 32)"
      MISSING_ENV=1
    else
      pass "MASTER_ENCRYPTION_KEY is set (${#VAL} chars)"
    fi
  else
    fail "MASTER_ENCRYPTION_KEY is missing from .env"
    MISSING_ENV=1
  fi

  if [ "$MISSING_ENV" -eq 0 ]; then
    pass "All required environment variables are present"
  fi
else
  fail ".env file does not exist (copy .env.example to .env and edit it)"
fi

# ──────────────────────────────────────────────
# 6. Network & Port Availability
# ──────────────────────────────────────────────
header "Network"

PORT="${PORT:-8400}"
if command -v ss &>/dev/null; then
  if ss -tln "sport = :$PORT" 2>/dev/null | grep -q .; then
    warn "Port $PORT is already in use — change PORT in .env or stop the other process"
  else
    pass "Port $PORT is available"
  fi
elif command -v netstat &>/dev/null; then
  if netstat -tln 2>/dev/null | grep -q ":$PORT "; then
    warn "Port $PORT is already in use"
  else
    pass "Port $PORT is available"
  fi
else
  warn "Cannot check port availability (install net-tools or iproute2)"
fi

# Check DNS resolution for Groq API
if command -v nslookup &>/dev/null; then
  if nslookup api.groq.com &>/dev/null 2>&1; then
    pass "Groq API (api.groq.com) is reachable via DNS"
  else
    warn "Cannot resolve api.groq.com — check your DNS/network settings"
  fi
elif command -v host &>/dev/null; then
  if host api.groq.com &>/dev/null 2>&1; then
    pass "Groq API (api.groq.com) is reachable via DNS"
  else
    warn "Cannot resolve api.groq.com — check your DNS/network settings"
  fi
else
  warn "Cannot check DNS resolution (no nslookup/host — skipping)"
fi

# ──────────────────────────────────────────────
# 7. Disk Space
# ──────────────────────────────────────────────
header "Disk Space"

if command -v df &>/dev/null; then
  AVAIL_KB="$(df . --output=avail 2>/dev/null | tail -1 || echo 0)"
  if [ "$AVAIL_KB" -gt 1048576 ]; then
    pass "More than 1 GB free disk space ($((AVAIL_KB / 1024)) MB available)"
  elif [ "$AVAIL_KB" -gt 0 ]; then
    warn "Low disk space: $((AVAIL_KB / 1024)) MB available"
  else
    warn "Could not determine available disk space"
  fi
fi

# ──────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────
TOTAL=$((PASS + FAIL + WARN))
echo ""
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo -e "  Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, ${YELLOW}$WARN warnings${NC}"
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}❌  Some checks failed. Please address the issues above before running the project.${NC}"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo -e "${YELLOW}⚠️   All critical checks passed, but there are $WARN warnings to review.${NC}"
  exit 0
else
  echo -e "${GREEN}✅  Everything looks great! The project is ready to run.${NC}"
  exit 0
fi
