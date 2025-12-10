#!/bin/bash
# Railway Pre-build Script
# This script runs before the main build to prepare the environment

set -e  # Exit on any error

echo "🚀 Railway Pre-build Script Starting..."

# ============================================
# 1. Verify Required Environment Variables
# ============================================
echo "📋 Checking required environment variables..."

REQUIRED_VARS=(
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY"
    "ADMIN_PASSWORD_HASH"
    "SESSION_SECRET"
)

MISSING_VARS=()

for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        MISSING_VARS+=("$VAR")
    fi
done

# Check for either SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY
if [ -z "$SUPABASE_SERVICE_KEY" ] && [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    MISSING_VARS+=("SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "❌ ERROR: Missing required environment variables:"
    printf '   - %s\n' "${MISSING_VARS[@]}"
    echo ""
    echo "Please configure these in Railway Dashboard > Settings > Variables"
    exit 1
fi

echo "✅ All required environment variables are set"

# ============================================
# 2. Create necessary directories
# ============================================
echo "📁 Creating necessary directories..."

mkdir -p logs
mkdir -p sessions
mkdir -p public/css

echo "✅ Directories created"

# ============================================
# 3. Display build information
# ============================================
echo "ℹ️  Build Information:"
echo "   - Node version: $(node --version)"
echo "   - npm version: $(npm --version)"
echo "   - NODE_ENV: ${NODE_ENV:-development}"
echo "   - PORT: ${PORT:-3000}"

echo "✅ Pre-build script completed successfully!"
