#!/bin/bash
# Keep-alive wrapper for Next.js dev server
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting Next.js dev server on port 3000..."
  npx next dev --port 3000
  echo "[$(date)] Server exited with code $?. Restarting in 3s..."
  sleep 3
done