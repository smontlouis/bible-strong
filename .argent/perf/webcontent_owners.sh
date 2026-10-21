#!/bin/bash
# Lists every WebKit WebContent process with its CPU use and the simulator it runs in,
# to tell a Bible DOM WebView of the app under test from WebViews of other simulators.
for p in $(pgrep -f "com.apple.WebKit.WebContent"); do
  device=$(lsof -p "$p" 2>/dev/null | grep -oE "Devices/[0-9A-F-]{36}" | head -1)
  cpu=$(ps -o %cpu= -p "$p")
  echo "pid=$p cpu=${cpu}% ${device:-unknown}"
done
xcrun simctl list devices booted
