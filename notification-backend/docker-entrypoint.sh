#!/bin/sh
set -e

echo "Applying pending Prisma migrations..."
npx prisma migrate deploy

echo "Starting server..."
exec node dist/server.js
