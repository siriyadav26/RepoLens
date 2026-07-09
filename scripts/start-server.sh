#!/bin/bash
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "200"; then
  fuser -k 3000/tcp 2>/dev/null
  sleep 1
  cd /home/z/my-project
  npx next dev --port 3000 > /tmp/next-cron.log 2>&1 &
  echo "$(date): Restarted server PID $!" >> /tmp/server-restarts.log
fi
