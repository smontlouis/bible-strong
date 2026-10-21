#!/bin/bash
# Prints memory (RSS) and CPU of the production app of a simulator at a fixed interval.
# Usage: watch_memory.sh <simulator udid> <samples> <interval seconds> [executable]
# executable: BibleStrong (production, default) or devBibleStrong (dev client)
udid=$1
samples=${2:-10}
interval=${3:-30}
executable=${4:-BibleStrong}
pid=$(pgrep -f "Devices/$udid/data/Containers/Bundle/Application/.*\.app/$executable\$" | head -1)
echo "pid $pid"
for _ in $(seq "$samples"); do
  ps -o rss=,%cpu=,state= -p "$pid" | awk -v t="$(date +%T)" '{printf "%s  %5.0f MB  cpu %5.1f%%  %s\n", t, $1/1024, $2, $3}'
  sleep "$interval"
done
