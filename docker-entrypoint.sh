#!/bin/sh
set -e

# Auto-generate NEXTAUTH_SECRET if not provided
if [ -z "$NEXTAUTH_SECRET" ]; then
  export NEXTAUTH_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  echo "[SanHub] ✓ Auto-generated NEXTAUTH_SECRET"
fi

# Default NEXTAUTH_URL for development
if [ -z "$NEXTAUTH_URL" ]; then
  export NEXTAUTH_URL="http://localhost:3000"
  echo "[SanHub] ⚠️  Using default NEXTAUTH_URL: $NEXTAUTH_URL"
  echo "[SanHub] ⚠️  For production, set NEXTAUTH_URL in .env file"
fi

# Require admin credentials (no defaults for security)
if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
  echo ""
  echo "=========================================="
  echo "❌ ERROR: Admin credentials not configured"
  echo "=========================================="
  echo ""
  echo "Please create a .env file with:"
  echo ""
  echo "  ADMIN_EMAIL=your-email@example.com"
  echo "  ADMIN_PASSWORD=your-secure-password"
  echo ""
  echo "Quick start:"
  echo "  cp .env.example .env"
  echo "  nano .env  # Edit ADMIN_EMAIL and ADMIN_PASSWORD"
  echo ""
  exit 1
fi

echo "[SanHub] ✓ Configuration validated"
echo "[SanHub] Starting server..."
exec "$@"
