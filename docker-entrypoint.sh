#!/bin/sh
set -e

# Auto-generate NEXTAUTH_SECRET if not provided
if [ -z "$NEXTAUTH_SECRET" ]; then
  # Generate a random 32-byte hex string
  export NEXTAUTH_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  echo "[SanHub] Auto-generated NEXTAUTH_SECRET"
fi

# Auto-detect NEXTAUTH_URL if not provided
if [ -z "$NEXTAUTH_URL" ]; then
  export NEXTAUTH_URL="http://localhost:3000"
  echo "[SanHub] Using default NEXTAUTH_URL: $NEXTAUTH_URL"
fi

# Set default admin credentials if not provided
if [ -z "$ADMIN_EMAIL" ]; then
  export ADMIN_EMAIL="admin@sanhub.local"
  echo "[SanHub] Using default ADMIN_EMAIL: $ADMIN_EMAIL"
fi

if [ -z "$ADMIN_PASSWORD" ]; then
  export ADMIN_PASSWORD="sanhub123"
  echo "[SanHub] Using default ADMIN_PASSWORD: sanhub123"
  echo "[SanHub] ⚠️  Please change the admin password after first login!"
fi

echo "[SanHub] Starting server..."
exec "$@"
