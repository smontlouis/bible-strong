#!/usr/bin/env python3
"""Inclusive and self time per JS function in a Hermes CPU profile (.cpuprofile JSON).

Usage: hermes_inclusive.py <cpu.json> [top_n] [filter]
A frame is printed as name (bundle line). The optional filter keeps only stacks that contain
a frame whose name includes it, to see what runs under a given function.
"""
import collections
import json
import sys

profile = json.load(open(sys.argv[1]))
top_n = int(sys.argv[2]) if len(sys.argv) > 2 else 40
needle = sys.argv[3] if len(sys.argv) > 3 else None

nodes = {n['id']: n for n in profile['nodes']}
parent = {}
for n in profile['nodes']:
    for c in n.get('children', []):
        parent[c] = n['id']


def label(node):
    cf = node['callFrame']
    return f"{cf.get('functionName') or '(anonymous)'} (line {cf.get('lineNumber', -1) + 1})"


def stack(node_id):
    out = []
    while node_id is not None:
        out.append(label(nodes[node_id]))
        node_id = parent.get(node_id)
    return out  # leaf first


samples = profile['samples']
deltas = profile.get('timeDeltas', [1] * len(samples))
inclusive = collections.Counter()
self_time = collections.Counter()
total = 0.0
for sid, dt in zip(samples, deltas):
    dt = max(dt, 0) / 1000.0
    # Long gaps are the sampler stalling (app suspended), not work
    if dt > 200:
        continue
    st = stack(sid)
    if needle and not any(needle in f for f in st):
        continue
    total += dt
    self_time[st[0]] += dt
    for f in set(st):
        inclusive[f] += dt

print(f'{total:.0f} ms sampled' + (f' under "{needle}"' if needle else ''))
print('\nTop inclusive:')
for f, t in inclusive.most_common(top_n):
    print(f'  {t:8.0f} ms  {f[:150]}')
print('\nTop self:')
for f, t in self_time.most_common(20):
    print(f'  {t:8.0f} ms  {f[:150]}')
