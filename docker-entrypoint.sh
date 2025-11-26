#!/bin/sh
set -e

echo "Starting container..."

# Wait for DATABASE_URL if prisma operations required (optional small retry)
if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL present - running prisma generate and migrations"
  # generate client with provided DATABASE_URL
  npx prisma generate

  # run migrations in production safely (if migrations exist)
  # Use migrate deploy (won't prompt like dev)
  if [ -d "./prisma/migrations" ]; then
    npx prisma migrate deploy || {
      echo "prisma migrate deploy failed - continuing (check migration status)"
    }
  fi
else
  echo "No DATABASE_URL provided. Skipping prisma generate/migrate."
fi

# Start app
echo "Starting app with: $@"
exec "$@"
