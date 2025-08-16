#!/bin/bash

echo "Pulling via GIT"
# FIX: Remove git index.lock file if it exists due to a previous crash
# This prevents "fatal: Unable to create '/home/container/.git/index.lock': File exists." errors
rm -f /home/container/.git/index.lock
git reset --hard
git pull https://github.com/M1noa/web2video

/usr/local/bin/npm install --no-audit --no-fund

echo "Building application..."
/usr/local/bin/npm run build

echo "Starting application..."
/usr/local/bin/npm start
echo "Stopped."