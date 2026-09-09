"""Simulator RSS proxy, NOT iOS physical footprint; includes all WebKit processes on this simulator."""
import datetime
import json
import pathlib
import subprocess
import sys

udid, label = sys.argv[1:3]
services = subprocess.check_output(['xcrun', 'simctl', 'spawn', udid, 'launchctl', 'list'], text=True)
app_pid = next(int(line.split()[0]) for line in services.splitlines() if 'com.smontlouis.biblestrong.dev[' in line)
rows = []
for line in subprocess.check_output(['ps', '-axo', 'pid,ppid,rss,comm'], text=True).splitlines()[1:]:
    fields = line.strip().split(None, 3)
    if len(fields) == 4:
        rows.append(dict(pid=int(fields[0]), ppid=int(fields[1]), rssKiB=int(fields[2]), command=fields[3]))
app = next(row for row in rows if row['pid'] == app_pid)
selected = [row for row in rows if row['pid'] == app_pid or (row['ppid'] == app['ppid'] and 'WebKit' in row['command'])]
result = dict(label=label, at=datetime.datetime.now(datetime.timezone.utc).isoformat(), processes=selected, totalRssMiB=round(sum(row['rssKiB'] for row in selected)/1024, 1))
path = pathlib.Path(__file__).with_name('memory.json')
previous = json.loads(path.read_text()) if path.exists() else []
path.write_text(json.dumps(previous + [result], indent=2))
print(json.dumps(dict(label=label, totalRssMiB=result['totalRssMiB'], appRssMiB=round(app['rssKiB']/1024, 1), webkitProcesses=len(selected)-1)))
