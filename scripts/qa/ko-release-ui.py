#!/usr/bin/env python3
"""Small accessibility-driven UI checks for the Android release emulator."""

import subprocess
import sys
import time
import os
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = "com.liftosaur.www.twa"
ARTIFACT_DIR = Path(os.environ.get("QA_ARTIFACTS_DIR", "qa-artifacts/native-upgrade"))


def adb(*args: str) -> str:
    result = subprocess.run(["adb", *args], check=True, capture_output=True, text=True)
    return result.stdout


def hierarchy() -> ET.Element:
    adb("shell", "uiautomator", "dump", "/sdcard/ko-release-ui.xml")
    return ET.fromstring(adb("shell", "cat", "/sdcard/ko-release-ui.xml"))


def bounds_center(bounds: str) -> tuple[int, int]:
    first, second = bounds.strip("[]").split("][")
    x1, y1 = (int(value) for value in first.split(","))
    x2, y2 = (int(value) for value in second.split(","))
    return (x1 + x2) // 2, (y1 + y2) // 2


def find_text(root: ET.Element, needle: str, exact: bool = False) -> ET.Element | None:
    for node in root.iter("node"):
        value = node.attrib.get("text", "") or node.attrib.get("content-desc", "")
        if value == needle if exact else needle in value:
            return node
    return None


def wait_text(needle: str, exact: bool = False, timeout: int = 30) -> ET.Element:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        node = find_text(hierarchy(), needle, exact)
        if node is not None:
            return node
        time.sleep(1)
    raise RuntimeError(f"Timed out waiting for visible text: {needle}")


def tap_node(node: ET.Element) -> None:
    x, y = bounds_center(node.attrib["bounds"])
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(1)


def tap_clickable_text(needle: str, exact: bool = False) -> None:
    root = hierarchy()
    parents = {child: parent for parent in root.iter("node") for child in parent}
    for node in root.iter("node"):
        value = node.attrib.get("text", "") or node.attrib.get("content-desc", "")
        if value == needle if exact else needle in value:
            ancestor = clickable_ancestor(root, node)
            if ancestor is not node or node.attrib.get("clickable") == "true":
                tap_node(ancestor)
                return
    raise RuntimeError(f"Could not find clickable visible text: {needle}")


def tap_text(needle: str, exact: bool = False) -> None:
    tap_node(wait_text(needle, exact))


def find_id(root: ET.Element, needle: str) -> ET.Element | None:
    for node in root.iter("node"):
        if node.attrib.get("resource-id", "").endswith(needle):
            return node
    return None


def wait_id(needle: str, timeout: int = 30) -> ET.Element:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        node = find_id(hierarchy(), needle)
        if node is not None:
            return node
        time.sleep(1)
    raise RuntimeError(f"Timed out waiting for UI resource id: {needle}")


def clickable_ancestor(root: ET.Element, node: ET.Element) -> ET.Element:
    parents = {child: parent for parent in root.iter("node") for child in parent}
    current = node
    while current in parents:
        current = parents[current]
        if current.attrib.get("clickable") == "true":
            return current
    return node


def scroll_until_text(needle: str, exact: bool = False) -> tuple[ET.Element, ET.Element]:
    for _ in range(8):
        root = hierarchy()
        node = find_text(root, needle, exact)
        if node is not None:
            return root, node
        adb("shell", "input", "swipe", "520", "1550", "520", "420", "350")
        time.sleep(0.5)
    raise RuntimeError(f"Could not scroll to visible text: {needle}")


def switch_account(account_id: str, expected_program: str) -> None:
    tap_text("내 정보", exact=True)
    tap_clickable_text("계정", exact=True)
    root, account = scroll_until_text(f"id: {account_id}", exact=True)
    tap_node(clickable_ancestor(root, account))
    try:
        tap_text("OK", exact=True)
    except RuntimeError:
        tap_text("확인", exact=True)
    time.sleep(4)
    tap_text("홈", exact=True)
    wait_text(expected_program)
    print(f"PASS: switched to {account_id} and displayed its fixture program")


def open_fixture_workout() -> None:
    tap_node(wait_id("footer-workout"))
    time.sleep(3)
    root = hierarchy()
    marker = find_text(root, "한국어 기록 보존 검증")
    if marker is None:
        raise RuntimeError("Workout screen did not expose the fixture workout/program marker")
    print("PASS: opened the seeded in-progress workout and found its Korean fixture marker")


def assert_measurement(value: str, label: str) -> None:
    tap_text("내 정보", exact=True)
    root, node = scroll_until_text(value)
    save_hierarchy(root, f"{label}-measurement")
    print(f"PASS: settings UI displays fixture measurement value {value}: {node.attrib.get('text', '')}")
    tap_text("홈", exact=True)


def assert_completed_history_set(label: str) -> None:
    tap_text("내 정보", exact=True)
    tap_clickable_text("운동 종목", exact=True)
    try:
        root, exercise = scroll_until_text("Bent Over Row")
    except RuntimeError:
        root, exercise = scroll_until_text("벤트")
    tap_node(clickable_ancestor(root, exercise))
    root, _ = scroll_until_text("2 × 8 × 20 kg")
    if find_id(root, "history-entry-sets-completed") is None:
        raise RuntimeError("The completed workout history did not show two sets of 8 reps at 20 kg")
    save_hierarchy(root, f"{label}-completed-history-2x8x20kg")
    print("PASS: exercise history UI displays 2 × 8 × 20 kg in a completed-set row")
    tap_text("홈", exact=True)


def save_hierarchy(root: ET.Element, label: str) -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    (ARTIFACT_DIR / f"{label}.xml").write_bytes(ET.tostring(root, encoding="utf-8", xml_declaration=True))


def main() -> None:
    if len(sys.argv) < 2:
        raise RuntimeError("usage: ko-release-ui.py <assert-text|switch-account|open-fixture-workout|assert-measurement|assert-completed-history> ...")
    action = sys.argv[1]
    if action == "assert-text" and len(sys.argv) == 3:
        wait_text(sys.argv[2])
        print(f"PASS: visible UI contains fixture marker: {sys.argv[2]}")
    elif action == "switch-account" and len(sys.argv) == 4:
        switch_account(sys.argv[2], sys.argv[3])
    elif action == "open-fixture-workout" and len(sys.argv) == 2:
        open_fixture_workout()
    elif action == "assert-measurement" and len(sys.argv) == 4:
        assert_measurement(sys.argv[2], sys.argv[3])
    elif action == "assert-completed-history" and len(sys.argv) == 3:
        assert_completed_history_set(sys.argv[2])
    else:
        raise RuntimeError("invalid arguments")


if __name__ == "__main__":
    main()
