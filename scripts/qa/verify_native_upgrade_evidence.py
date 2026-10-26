#!/usr/bin/env python3
"""Check that native-upgrade evidence exists for a candidate version."""

import re
import sys
from pathlib import Path


VERSION_RE = re.compile(r"^[0-9]+\.[0-9]+(?:\.[0-9]+)?(?:[.-][A-Za-z0-9.-]+)?$")


def required_evidence_files(candidate_version: str) -> list[str]:
    if not VERSION_RE.fullmatch(candidate_version):
        raise ValueError(f"Invalid candidate version: {candidate_version}")

    candidate = f"v{candidate_version}"
    required = [
        "RESULTS.txt",
        "signature-comparison.txt",
        "v158-package.txt",
        f"{candidate}-package.txt",
        "v158-mmkv-default.bin",
        f"{candidate}-mmkv-default.bin",
        "v158-before-upgrade.png",
        "v158-before-upgrade.xml",
        f"{candidate}-default.png",
        f"{candidate}-default.xml",
    ]
    for version in ("v158", candidate):
        for account in ("primary", "secondary"):
            required.extend(
                [
                    f"{version}-{account}-measurement.xml",
                    f"{version}-{account}-completed-history-2x8x20kg.xml",
                ]
            )
    for capture in (
        f"{candidate}-workout-font-scale-1_3",
        f"{candidate}-workout-font-scale-2_0",
        f"{candidate}-workout-width-320dp-font-scale-1_0",
        f"{candidate}-workout-width-320dp-font-scale-2_0",
    ):
        required.extend([f"{capture}.png", f"{capture}.xml", f"{capture}-display-settings.txt"])
    return required


def verify_evidence(candidate_version: str, output_dir: Path, extra_files: list[str] | None = None) -> None:
    required = required_evidence_files(candidate_version) + (extra_files or [])
    missing = [
        str(output_dir / name)
        for name in required
        if not (output_dir / name).is_file() or (output_dir / name).stat().st_size == 0
    ]
    if missing:
        raise FileNotFoundError("Required native QA evidence is missing or empty:\n" + "\n".join(missing))
    print(f"PASS: {len(required)} required native QA files exist and are non-empty (presence only).")


def main() -> int:
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} CANDIDATE_VERSION OUTPUT_DIR [EXTRA_FILE ...]", file=sys.stderr)
        return 2
    try:
        verify_evidence(sys.argv[1], Path(sys.argv[2]), sys.argv[3:])
    except (ValueError, FileNotFoundError) as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
