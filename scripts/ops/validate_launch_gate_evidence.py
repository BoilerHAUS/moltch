#!/usr/bin/env python3
import argparse
import glob
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import urlparse

from jsonschema import Draft202012Validator, FormatChecker


def _format_error_path(error) -> str:
    if not error.absolute_path:
        return "$"
    path = "$"
    for segment in error.absolute_path:
        if isinstance(segment, int):
            path += f"[{segment}]"
        else:
            path += f".{segment}"
    return path


def build_format_checker() -> FormatChecker:
    checker = FormatChecker()

    @checker.checks("uri")
    def _is_uri(value: object) -> bool:
        if not isinstance(value, str):
            return True
        parsed = urlparse(value)
        return bool(parsed.scheme and parsed.netloc)

    @checker.checks("date-time")
    def _is_datetime(value: object) -> bool:
        if not isinstance(value, str):
            return True
        try:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
            return True
        except ValueError:
            return False

    return checker


def validate_file(validator: Draft202012Validator, json_path: str) -> List[str]:
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
    except Exception as e:
        return [f"{json_path}: failed to parse JSON ({e})"]

    errors = sorted(validator.iter_errors(payload), key=lambda e: (list(e.absolute_path), e.message))
    if not errors:
        return []

    out: List[str] = []
    for err in errors:
        loc = _format_error_path(err)
        out.append(f"{json_path}: {loc}: {err.message}")
    return out


def load_schema(schema_path: str) -> Dict[str, Any]:
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema", required=True)
    parser.add_argument("--input", action="append", dest="inputs", default=[])
    parser.add_argument("--input-glob", action="append", dest="globs", default=[])
    args = parser.parse_args()

    if not os.path.exists(args.schema):
        print(f"[launch-gate-validate][fail] schema not found: {args.schema}", file=sys.stderr)
        sys.exit(1)

    schema = load_schema(args.schema)
    validator = Draft202012Validator(schema, format_checker=build_format_checker())

    files: List[str] = list(args.inputs)
    for pattern in args.globs:
        files.extend(sorted(glob.glob(pattern, recursive=True)))

    files = sorted({str(Path(f)) for f in files})
    if not files:
        print("[launch-gate-validate][fail] no input files provided", file=sys.stderr)
        sys.exit(1)

    all_errors: List[str] = []
    for fpath in files:
        all_errors.extend(validate_file(validator, fpath))

    if all_errors:
        for err in all_errors:
            print(f"[launch-gate-validate][fail] {err}", file=sys.stderr)
        sys.exit(1)

    for fpath in files:
        print(f"[launch-gate-validate][pass] {fpath}")


if __name__ == "__main__":
    main()
