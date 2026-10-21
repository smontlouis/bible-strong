#!/bin/bash
# Records Time Profiler on the production app of a simulator, independently of argent.
# Usage: record.sh <simulator udid> <seconds> <output.trace>
udid=$1
seconds=$2
out=$3
pid=$(pgrep -f "Devices/$udid/data/Containers/Bundle/Application/.*/BibleStrong.app/BibleStrong" | head -1)
if [ -z "$pid" ]; then
  echo "production app not running on $udid" >&2
  exit 1
fi
rm -rf "$out"
echo "recording pid $pid for ${seconds}s into $out"
xcrun xctrace record --template 'Time Profiler' --attach "$pid" --time-limit "${seconds}s" --output "$out" --no-prompt >/dev/null 2>&1
echo "done: $out"
