#!/bin/bash
# Captures the production app's logs (JS console included) from a simulator for a while.
# Usage: app_logs.sh <simulator udid> <seconds> <output file>
udid=$1
seconds=$2
out=$3
xcrun simctl spawn "$udid" log stream --style compact --level debug \
  --predicate 'process == "BibleStrong"' > "$out" 2>&1 &
stream=$!
sleep "$seconds"
kill "$stream"
echo "$(wc -l < "$out") lines in $out"
