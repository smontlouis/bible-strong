#!/bin/bash
# Average CPU of the app under test and of its Bible WebView while the screen is left alone.
# Usage: idle_cpu.sh <simulator udid> [seconds]
udid=$1
seconds=${2:-6}
app=$(pgrep -f "Devices/$udid/data/Containers/Bundle/Application/.*/BibleStrong.app/BibleStrong" | head -1)
webviews=""
for p in $(pgrep -f "com.apple.WebKit.WebContent"); do
  if lsof -p "$p" 2>/dev/null | grep -q "Devices/$udid"; then webviews="$webviews $p"; fi
done
echo "app pid=$app webview pids=$webviews"
for p in $app $webviews; do
  # top's first sample has no CPU delta, so it is skipped
  avg=$(top -l $((seconds + 1)) -s 1 -pid "$p" -stats cpu | grep -E '^[0-9.]+$' | tail -n "$seconds" | awk '{s+=$1} END {printf "%.1f", s/NR}')
  echo "pid=$p avg cpu=${avg}% over ${seconds}s"
done
