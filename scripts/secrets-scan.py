#!/usr/bin/env python3
"""Fail-closed credential scan over tracked files.

Patterns target real credential SHAPES, not placeholders such as
`sk-your-key-here` or test fixtures like `sk-openrouter-provider-key`, so a
demo value cannot create false failures. Any real-shaped hit fails the scan.
"""
from __future__ import annotations

import re
import subprocess
import sys

PATTERNS = [
    ("OpenAI-style key", re.compile(r"sk-(?:or-|proj-)?[A-Za-z0-9]{20,}")),
    ("Google API key", re.compile(r"AIza[0-9A-Za-z_-]{35,}")),
    ("GitHub token", re.compile(r"gh[pousr]_[A-Za-z0-9]{36,}")),
    ("private key block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
]


def main() -> int:
    tracked = subprocess.run(
        ["git", "ls-files"], capture_output=True, text=True, check=True
    ).stdout.splitlines()
    hits = []
    for path in tracked:
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as handle:
                text = handle.read()
        except OSError:
            continue
        for name, pattern in PATTERNS:
            if pattern.search(text):
                hits.append((path, name))
    for path, name in hits:
        print(f"SECRET HIT: {path}: {name}")
    print(f"tracked_files={len(tracked)} hits={len(hits)}")
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main())
