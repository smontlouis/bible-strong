#!/usr/bin/env python3
"""Summarize an Instruments Time Profiler trace of Bible Strong.

Usage: analyze_time_profile.py <file.trace> [bucket_ms] [top_n]

Prints, for the main thread and the JavaScript thread:
- CPU use per time bucket (to see when a thread is saturated and for how long),
- the longest stretch where the thread stayed busy,
- the hottest leaf frames and the hottest frames anywhere in the stack.
Frames are native: in a Release build Hermes runs bytecode, so JavaScript function names
are not visible, but Hermes builtins (JSON, regexp, GC) and native modules (MMKV, SQLite,
Fabric) are.
"""
import collections
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

trace = sys.argv[1]
bucket_ms = int(sys.argv[2]) if len(sys.argv) > 2 else 500
top_n = int(sys.argv[3]) if len(sys.argv) > 3 else 25

with tempfile.NamedTemporaryFile(suffix='.xml') as out:
    subprocess.run(
        [
            'xcrun', 'xctrace', 'export', '--input', trace, '--output', out.name,
            '--xpath', '/trace-toc/run[@number="1"]/data/table[@schema="time-profile"]',
        ],
        check=True, capture_output=True,
    )
    root = ET.parse(out.name).getroot()

# Instruments deduplicates repeated elements: the first occurrence carries id=, later ones ref=.
by_id = {}
for el in root.iter():
    if 'id' in el.attrib:
        by_id[el.attrib['id']] = el


def resolve(el):
    return by_id.get(el.attrib['ref'], el) if el is not None and 'ref' in el.attrib else el


def thread_name(row):
    """'<process>/<thread>', with 'main' for main threads, e.g. 'BibleStrong/main'."""
    t = resolve(row.find('thread'))
    if t is None:
        return '?'
    fmt = t.attrib.get('fmt', '')
    process = fmt.rsplit('(', 1)[-1].split(',')[0] if '(' in fmt else '?'
    name = 'main' if fmt.startswith('Main Thread') else fmt.split(' (')[0]
    return f'{process}/{name}'


def frames(row):
    bt = resolve(row.find('tagged-backtrace'))
    if bt is None:
        bt = resolve(row.find('backtrace'))
    if bt is None:
        return []
    names = []
    for f in bt.findall('frame'):
        f = resolve(f)
        names.append(f.attrib.get('name', '?'))
    return names  # leaf first


def weight_ms(row):
    w = resolve(row.find('weight'))
    try:
        return int(w.text) / 1e6 if w is not None and w.text else 1.0
    except ValueError:
        return 1.0


def time_ms(row):
    t = resolve(row.find('sample-time'))
    return int(t.text) / 1e6


rows = root.findall('.//row')
samples = [(time_ms(r), thread_name(r), weight_ms(r), frames(r)) for r in rows]
if not samples:
    sys.exit('no samples')
t0 = min(s[0] for s in samples)
t1 = max(s[0] for s in samples)
print(f'trace {trace}\nduration {(t1 - t0) / 1000:.1f}s, {len(samples)} samples\n')

per_process = collections.Counter()
for _, name, w, _ in samples:
    per_process[name.split('/')[0]] += w
print('CPU per process:')
for name, w in per_process.most_common(8):
    print(f'  {w:8.0f} ms  {name}')
print()

JS = 'BibleStrong/com.facebook.react.runtime.JavaScript'
for label, match in (
    ('APP MAIN THREAD', lambda n: n == 'BibleStrong/main'),
    ('APP JS THREAD', lambda n: n.startswith(JS)),
    ('WEBVIEW (WebContent main threads)', lambda n: n == 'com.apple.WebKit.WebContent/main'),
):
    mine = [s for s in samples if match(s[1])]
    total = sum(s[2] for s in mine)
    print(f'=== {label}: {total:.0f} ms CPU over {(t1 - t0) / 1000:.1f}s')
    buckets = collections.Counter()
    for t, _, w, _ in mine:
        buckets[int((t - t0) // bucket_ms)] += w
    line = []
    for b in range(int((t1 - t0) // bucket_ms) + 1):
        pct = 100 * buckets[b] / bucket_ms
        line.append(f'{b * bucket_ms / 1000:>5.1f}s {pct:3.0f}%')
    for i in range(0, len(line), 8):
        print('  ' + ' | '.join(line[i:i + 8]))
    # Longest run of consecutive buckets above 80 %.
    best, cur, start, best_start = 0, 0, 0, 0
    for b in range(int((t1 - t0) // bucket_ms) + 1):
        if buckets[b] >= 0.8 * bucket_ms:
            if cur == 0:
                start = b
            cur += 1
            if cur > best:
                best, best_start = cur, start
        else:
            cur = 0
    print(f'  longest saturated stretch (>80%): {best * bucket_ms / 1000:.1f}s from {best_start * bucket_ms / 1000:.1f}s')
    leaf = collections.Counter()
    inclusive = collections.Counter()
    for _, _, w, fr in mine:
        if fr:
            leaf[fr[0]] += w
        for name in set(fr):
            inclusive[name] += w
    print('  top leaf frames:')
    for name, w in leaf.most_common(top_n):
        print(f'    {w:7.0f} ms  {name[:140]}')
    print('  top inclusive frames:')
    for name, w in inclusive.most_common(top_n):
        print(f'    {w:7.0f} ms  {name[:140]}')
    print()
