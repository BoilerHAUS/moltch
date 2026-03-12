#!/usr/bin/env python3
import argparse
import csv
import json
import os
import time
from datetime import datetime, timezone, timedelta
from urllib import request, error


def iso_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def run_live(url, probes, interval_s, timeout_s):
    rows = []
    for i in range(probes):
        ts = iso_now()
        ok = False
        status = None
        err = None
        try:
            req = request.Request(url, method='GET')
            with request.urlopen(req, timeout=timeout_s) as resp:
                status = resp.getcode()
                ok = 200 <= status < 300
        except error.HTTPError as e:
            status = e.code
            err = str(e)
        except Exception as e:
            err = str(e)

        rows.append({
            'index': i + 1,
            'timestamp_utc': ts,
            'ok': ok,
            'status_code': status,
            'error': err,
        })
        if i < probes - 1:
            time.sleep(interval_s)
    return rows


def run_replay(start_utc, probes, interval_s, success_ratio):
    start = datetime.fromisoformat(start_utc.replace('Z', '+00:00'))
    fail_every = max(1, int(round(1 / max(0.001, (1 - success_ratio))))) if success_ratio < 1 else 10**9
    rows = []
    for i in range(probes):
        ts = (start + timedelta(seconds=i * interval_s)).replace(microsecond=0).isoformat()
        ok = ((i + 1) % fail_every) != 0
        rows.append({
            'index': i + 1,
            'timestamp_utc': ts,
            'ok': ok,
            'status_code': 200 if ok else 503,
            'error': None if ok else 'simulated_failure',
        })
    return rows


def summarize(rows):
    total = len(rows)
    ok_count = sum(1 for r in rows if r['ok'])
    fail_count = total - ok_count
    pct = round((ok_count / total) * 100, 3) if total else 0
    return {
        'probe_count': total,
        'success_count': ok_count,
        'failure_count': fail_count,
        'success_pct': pct,
    }


def write_outputs(out_dir, rows, summary, mode, target):
    os.makedirs(out_dir, exist_ok=True)

    csv_path = os.path.join(out_dir, 'readiness_24h.csv')
    with open(csv_path, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['index', 'timestamp_utc', 'ok', 'status_code', 'error'])
        w.writeheader()
        w.writerows(rows)

    json_path = os.path.join(out_dir, 'readiness_24h_summary.json')
    payload = {
        'generated_at': iso_now(),
        'mode': mode,
        'target': target,
        'summary': summary,
    }
    with open(json_path, 'w') as f:
        json.dump(payload, f, indent=2)

    md_path = os.path.join(out_dir, 'readiness_24h_summary.md')
    with open(md_path, 'w') as f:
        f.write('# readiness 24h summary\n\n')
        f.write(f'- generated_at: {payload["generated_at"]}\n')
        f.write(f'- mode: {mode}\n')
        f.write(f'- target: {target}\n')
        f.write(f'- probe_count: {summary["probe_count"]}\n')
        f.write(f'- success_pct: {summary["success_pct"]}\n')
        f.write(f'- failure_count: {summary["failure_count"]}\n')
        f.write('\n## failure slices\n')
        f.write('- if failure_count > 0: inspect readiness_24h.csv grouped by status_code/error\n')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--mode', choices=['live', 'replay'], required=True)
    p.add_argument('--url', default='http://localhost:8080/healthz')
    p.add_argument('--probes', type=int, default=288)
    p.add_argument('--interval-seconds', type=int, default=300)
    p.add_argument('--timeout-seconds', type=int, default=5)
    p.add_argument('--replay-start-utc', default='2026-03-10T00:00:00Z')
    p.add_argument('--replay-success-ratio', type=float, default=0.993)
    p.add_argument('--out-dir', required=True)
    args = p.parse_args()

    if args.mode == 'live':
        rows = run_live(args.url, args.probes, args.interval_seconds, args.timeout_seconds)
    else:
        rows = run_replay(args.replay_start_utc, args.probes, args.interval_seconds, args.replay_success_ratio)

    summary = summarize(rows)
    write_outputs(args.out_dir, rows, summary, args.mode, args.url)


if __name__ == '__main__':
    main()
