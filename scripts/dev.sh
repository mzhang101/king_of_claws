#!/usr/bin/env bash
# King of Claws — Dev Server Start Script
# Runs both server and client in parallel

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║      King of Claws — Dev Mode        ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
echo "  Server: http://localhost:3001"
echo "  Client: http://localhost:5173"
echo ""

cd "$(dirname "$0")/.."
npx concurrently \
  -n server,client \
  -c blue,green \
  "npx tsx watch packages/server/src/index.ts" \
  "npx vite --config packages/client/vite.config.ts packages/client"
