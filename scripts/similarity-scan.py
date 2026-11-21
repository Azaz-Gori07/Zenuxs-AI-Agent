#!/usr/bin/env python3
"""Detect copied code from the read-only ZCode reference in the target tree.

Standard library only. Normalizes lines (strip whitespace; drop short lines,
imports and comments), hashes every window of 8 consecutive meaningful lines in
the reference source files, then reports matching windows in target source files.
Excluded directories: node_modules, dist, build, .git, .work.
Hits are failures unless the target file is listed in
docs/recon/similarity-allow.txt as `path  # reason`.
"""
from __future__ import annotations

import hashlib
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REFERENCE = Path("/home/azaz/reference-outside-workspace/ZCode")
ALLOW_FILE = ROOT / "docs/recon/similarity-allow.txt"
WINDOW = 8
MIN_LINE = 25

# `.vscode-test` is a downloaded VS Code runtime (a test dependency, not
# target source), so it is excluded like node_modules.
EXCLUDED = {
    "node_modules", "dist", "build", ".git", ".work", ".next", "coverage",
    ".vscode-test",
}
SOURCE_SUFFIXES = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".rs", ".go",
    ".java", ".c", ".cc", ".cpp", ".h", ".hpp", ".sh", ".rb", ".php",
}
IMPORT_PREFIXES = (
    "import ", "import\t", "from ", "require(", "const ", "let ", "var ",
    "#include", "using ", "package ",
)
COMMENT_PREFIXES = ("//", "/*", "*/", "*", "#", "--", "<!--")


def normalize(line: str) -> str | None:
    stripped = line.strip()
    if len(stripped) < MIN_LINE:
        return None
    if stripped.startswith(COMMENT_PREFIXES):
        return None
    if stripped.startswith(IMPORT_PREFIXES):
        return None
    # Collapse internal whitespace so formatting-only edits still match.
    return " ".join(stripped.split())


def meaningful_lines(path: Path) -> list[tuple[int, str]]:
    result: list[tuple[int, str]] = []
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return result
    for number, line in enumerate(text.splitlines(), start=1):
        normalized = normalize(line)
        if normalized is not None:
            result.append((number, normalized))
    return result


def windows(lines: list[tuple[int, str]]) -> list[tuple[str, int]]:
    result = []
    for index in range(len(lines) - WINDOW + 1):
        chunk = "\n".join(text for _, text in lines[index : index + WINDOW])
        digest = hashlib.sha256(chunk.encode("utf-8", "replace")).hexdigest()
        result.append((digest, lines[index][0]))
    return result


def source_files(base: Path) -> list[Path]:
    files: list[Path] = []
    if not base.exists():
        return files
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDED]
        for name in filenames:
            if Path(name).suffix in SOURCE_SUFFIXES:
                files.append(Path(dirpath) / name)
    return files


def load_allowlist() -> dict[str, str]:
    allowed: dict[str, str] = {}
    if not ALLOW_FILE.exists():
        return allowed
    for raw in ALLOW_FILE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        path, sep, reason = line.partition("#")
        if sep:
            allowed[path.strip()] = reason.strip()
        else:
            allowed[path.strip()] = "allowed by similarity-allow.txt"
    return allowed


def main() -> int:
    if not REFERENCE.exists():
        print(f"REFERENCE MISSING: {REFERENCE}")
        return 2
    allow = load_allowlist()
    ref_index: dict[str, list[tuple[str, int]]] = {}
    for path in source_files(REFERENCE):
        for digest, start in windows(meaningful_lines(path)):
            ref_index.setdefault(digest, []).append(
                (str(path.relative_to(REFERENCE)), start)
            )

    hits: list[tuple[str, int, str, int]] = []
    for path in source_files(ROOT):
        rel = str(path.relative_to(ROOT))
        for digest, start in windows(meaningful_lines(path)):
            for ref_path, ref_start in ref_index.get(digest, []):
                hits.append((rel, start, ref_path, ref_start))

    failures = [h for h in hits if h[0] not in allow]
    print(f"reference_files={len(source_files(REFERENCE))} target_files={len(source_files(ROOT))}")
    print(f"windows_indexed={sum(len(v) for v in ref_index.values())} matches={len(hits)} failures={len(failures)}")
    for rel, start, ref_path, ref_start in failures:
        print(f"HIT target={rel}:{start} reference={ref_path}:{ref_start}")
    for rel, start, ref_path, ref_start in hits:
        if rel in allow:
            print(f"ALLOWED target={rel}:{start} reference={ref_path}:{ref_start} reason={allow[rel]}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
