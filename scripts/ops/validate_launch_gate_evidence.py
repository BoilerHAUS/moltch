#!/usr/bin/env python3
import argparse
import json
import os
import sys
from typing import Any, Dict, List


def schema_type_name(schema_type: str):
    return {
        "object": dict,
        "array": list,
        "string": str,
        "number": (int, float),
        "integer": int,
        "boolean": bool,
    }.get(schema_type)


def validate_node(node: Any, schema: Dict[str, Any], path: str, errors: List[str]):
    expected_type = schema.get("type")
    if expected_type:
        py_type = schema_type_name(expected_type)
        if py_type is None:
            errors.append(f"{path}: unsupported schema type '{expected_type}'")
            return
        if not isinstance(node, py_type) or (expected_type == "integer" and isinstance(node, bool)):
            errors.append(f"{path}: expected {expected_type}, got {type(node).__name__}")
            return

    if "enum" in schema and node not in schema["enum"]:
        errors.append(f"{path}: value '{node}' not in enum {schema['enum']}")

    if isinstance(node, str):
        min_length = schema.get("minLength")
        if min_length is not None and len(node) < min_length:
            errors.append(f"{path}: string length {len(node)} < minLength {min_length}")

    if isinstance(node, list):
        min_items = schema.get("minItems")
        if min_items is not None and len(node) < min_items:
            errors.append(f"{path}: array length {len(node)} < minItems {min_items}")
        item_schema = schema.get("items")
        if item_schema:
            for idx, item in enumerate(node):
                validate_node(item, item_schema, f"{path}[{idx}]", errors)

    if isinstance(node, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in node:
                errors.append(f"{path}.{key}: missing required field")

        properties = schema.get("properties", {})
        for key, child_schema in properties.items():
            if key in node:
                validate_node(node[key], child_schema, f"{path}.{key}", errors)


def validate_file(schema: Dict[str, Any], json_path: str) -> List[str]:
    try:
        with open(json_path) as f:
            payload = json.load(f)
    except Exception as e:
        return [f"{json_path}: failed to parse JSON ({e})"]

    errors: List[str] = []
    validate_node(payload, schema, "$", errors)
    return [f"{json_path}: {e}" for e in errors]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema", required=True)
    parser.add_argument("--input", action="append", dest="inputs", default=[])
    parser.add_argument("--input-glob", action="append", dest="globs", default=[])
    args = parser.parse_args()

    if not os.path.exists(args.schema):
        print(f"[launch-gate-validate][fail] schema not found: {args.schema}", file=sys.stderr)
        sys.exit(1)

    with open(args.schema) as f:
        schema = json.load(f)

    files: List[str] = list(args.inputs)

    if args.globs:
        import glob

        for pattern in args.globs:
            files.extend(sorted(glob.glob(pattern, recursive=True)))

    files = sorted(set(files))
    if not files:
        print("[launch-gate-validate][fail] no input files provided", file=sys.stderr)
        sys.exit(1)

    all_errors: List[str] = []
    for fpath in files:
        all_errors.extend(validate_file(schema, fpath))

    if all_errors:
        for err in all_errors:
            print(f"[launch-gate-validate][fail] {err}", file=sys.stderr)
        sys.exit(1)

    for fpath in files:
        print(f"[launch-gate-validate][pass] {fpath}")


if __name__ == "__main__":
    main()
