#!/bin/bash

echo "🚀 Deploying Schema to Production Database..."
echo "=============================================="
echo ""

# Check if DATABASE_URL_PROD is set
if [ -z "$DATABASE_URL_PROD" ]; then
  echo "❌ ERROR: DATABASE_URL_PROD is not set"
  echo "Please configure the production database URL in your secrets"
  exit 1
fi

echo "📋 Reading migration file..."
MIGRATION_FILE="server/migrations/001_production_schema.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ ERROR: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "✅ Migration file found"
echo ""
echo "🔄 Applying schema to production database..."
echo ""

# Apply the migration
psql "$DATABASE_URL_PROD" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ SUCCESS! Schema deployed to production database"
  echo ""
  echo "📊 Verifying deployment..."
  psql "$DATABASE_URL_PROD" -c "\dt" | head -20
  echo ""
  echo "🎉 Production deployment complete!"
else
  echo ""
  echo "❌ ERROR: Schema deployment failed"
  exit 1
fi
