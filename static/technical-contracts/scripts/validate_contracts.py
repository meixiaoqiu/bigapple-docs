from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]


class ContractError(Exception):
    pass


class ContractStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.cache: dict[Path, Any] = {}

    def load_json(self, path: Path) -> Any:
        path = path.resolve()
        if path not in self.cache:
            with path.open("r", encoding="utf-8") as handle:
                self.cache[path] = json.load(handle)
        return self.cache[path]

    def resolve_ref(self, ref: str, base_path: Path) -> tuple[Any, Path]:
        base_path = base_path.resolve()
        if ref.startswith("#"):
            target_path = base_path
            fragment = ref
        else:
            raw_path, marker, raw_fragment = ref.partition("#")
            target_path = (base_path.parent / raw_path).resolve()
            fragment = f"#{raw_fragment}" if marker else ""

        if not target_path.exists():
            raise ContractError(f"Missing $ref target file: {ref} from {base_path}")

        value = self.load_json(target_path)
        if fragment:
            if not fragment.startswith("#/"):
                raise ContractError(f"Unsupported $ref fragment: {ref} from {base_path}")
            for token in fragment[2:].split("/"):
                token = token.replace("~1", "/").replace("~0", "~")
                if not isinstance(value, dict) or token not in value:
                    raise ContractError(f"Missing $ref fragment token '{token}': {ref} from {base_path}")
                value = value[token]
        return value, target_path


def iter_json_files() -> list[Path]:
    return sorted(
        path
        for path in ROOT.rglob("*.json")
        if ".git" not in path.parts
    )


def iter_refs(value: Any) -> list[str]:
    refs: list[str] = []
    if isinstance(value, dict):
        ref = value.get("$ref")
        if isinstance(ref, str):
            refs.append(ref)
        for child in value.values():
            refs.extend(iter_refs(child))
    elif isinstance(value, list):
        for child in value:
            refs.extend(iter_refs(child))
    return refs


def type_matches(value: Any, expected: str) -> bool:
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "null":
        return value is None
    raise ContractError(f"Unsupported schema type: {expected}")


def check_format(value: str, fmt: str, path: str, errors: list[str]) -> None:
    if fmt == "date-time":
        try:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            errors.append(f"{path}: expected date-time, got {value!r}")
    elif fmt == "date":
        try:
            date.fromisoformat(value)
        except ValueError:
            errors.append(f"{path}: expected date, got {value!r}")


def validate_instance(
    value: Any,
    schema: dict[str, Any],
    schema_path: Path,
    store: ContractStore,
    path: str,
    errors: list[str],
) -> None:
    if "$ref" in schema:
        resolved, resolved_path = store.resolve_ref(schema["$ref"], schema_path)
        validate_instance(value, resolved, resolved_path, store, path, errors)
        return

    expected_type = schema.get("type")
    if expected_type is not None:
        expected_types = expected_type if isinstance(expected_type, list) else [expected_type]
        if not any(type_matches(value, item) for item in expected_types):
            errors.append(f"{path}: expected type {expected_type!r}, got {type(value).__name__}")
            return

    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: expected one of {schema['enum']!r}, got {value!r}")

    if isinstance(value, str):
        min_length = schema.get("minLength")
        if min_length is not None and len(value) < min_length:
            errors.append(f"{path}: expected length >= {min_length}")
        pattern = schema.get("pattern")
        if pattern and not re.match(pattern, value):
            errors.append(f"{path}: does not match pattern {pattern!r}")
        fmt = schema.get("format")
        if fmt:
            check_format(value, fmt, path, errors)

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        minimum = schema.get("minimum")
        if minimum is not None and value < minimum:
            errors.append(f"{path}: expected >= {minimum}, got {value}")
        maximum = schema.get("maximum")
        if maximum is not None and value > maximum:
            errors.append(f"{path}: expected <= {maximum}, got {value}")

    if isinstance(value, list):
        min_items = schema.get("minItems")
        if min_items is not None and len(value) < min_items:
            errors.append(f"{path}: expected at least {min_items} items")
        max_items = schema.get("maxItems")
        if max_items is not None and len(value) > max_items:
            errors.append(f"{path}: expected at most {max_items} items")
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, item in enumerate(value):
                validate_instance(item, item_schema, schema_path, store, f"{path}[{index}]", errors)

    if isinstance(value, dict):
        properties = schema.get("properties", {})
        required = schema.get("required", [])
        for key in required:
            if key not in value:
                errors.append(f"{path}: missing required property {key!r}")

        additional = schema.get("additionalProperties", True)
        if additional is False:
            for key in value:
                if key not in properties:
                    errors.append(f"{path}: unexpected property {key!r}")
        elif isinstance(additional, dict):
            for key, child in value.items():
                if key not in properties:
                    validate_instance(child, additional, schema_path, store, f"{path}.{key}", errors)

        for key, prop_schema in properties.items():
            if key in value:
                validate_instance(value[key], prop_schema, schema_path, store, f"{path}.{key}", errors)


def validate_json_and_refs(store: ContractStore) -> list[str]:
    errors: list[str] = []
    for path in iter_json_files():
        try:
            document = store.load_json(path)
        except json.JSONDecodeError as exc:
            errors.append(f"{path.relative_to(ROOT)}: invalid JSON: {exc}")
            continue
        for ref in iter_refs(document):
            try:
                store.resolve_ref(ref, path)
            except ContractError as exc:
                errors.append(str(exc))
    return errors


def validate_examples(store: ContractStore) -> list[str]:
    errors: list[str] = []
    for example_path in sorted((ROOT / "examples").glob("*.example.json")):
        schema_name = example_path.name.replace(".example.json", ".schema.json")
        schema_path = ROOT / "schemas" / schema_name
        if not schema_path.exists():
            errors.append(f"{example_path.relative_to(ROOT)}: missing schema {schema_name}")
            continue
        example = store.load_json(example_path)
        schema = store.load_json(schema_path)
        validate_instance(
            example,
            schema,
            schema_path,
            store,
            f"${example_path.relative_to(ROOT)}",
            errors,
        )
    return errors


def main() -> int:
    store = ContractStore(ROOT)
    errors = []
    errors.extend(validate_json_and_refs(store))
    errors.extend(validate_examples(store))

    if errors:
        print("Contract validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Contract validation passed.")
    print(f"Checked {len(iter_json_files())} JSON files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

