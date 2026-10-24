import importlib.util
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


HELPER_PATH = Path(__file__).with_name("ko-release-ui.py")
SPEC = importlib.util.spec_from_file_location("ko_release_ui", HELPER_PATH)
assert SPEC is not None and SPEC.loader is not None
ko_release_ui = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ko_release_ui)


def history_hierarchy(set_status_id: str) -> ET.Element:
    # Mirrors the C8 uiautomator shape: FastText exposes the combined set label
    # on its clickable history card and the child status uses a resource ID.
    return ET.fromstring(
        f"""<hierarchy>
          <node resource-id="menu-item-1792488600000" clickable="true"
            content-desc="Tue, Oct 20, 2026, 한국어 기록 보존 검증 주계정 - 장비와 운동 이름이 작은 화면에서 잘리는지 확인하기 위한 긴 루틴 제목, Week 1 - Workout A, Weight, e1RM, 🏆, 2 × 8 × 20kg, - × 42.5kg, Volume: 320kg">
            <node resource-id="{set_status_id}" text="" content-desc="" />
          </node>
        </hierarchy>"""
    )


class CompletedHistoryRowTest(unittest.TestCase):
    def test_c8_captured_incomplete_row_with_compacted_kg_is_rejected(self) -> None:
        root = history_hierarchy("history-entry-sets-incompleted")

        self.assertIsNone(ko_release_ui.find_completed_history_label(root, "2 × 8 × 20 kg"))

    def test_completed_fixture_row_matches_label_with_or_without_unit_space(self) -> None:
        root = history_hierarchy("history-entry-sets-completed")

        for expected in ("2 × 8 × 20 kg", "2 × 8 × 20kg"):
            with self.subTest(expected=expected):
                row = ko_release_ui.find_completed_history_label(root, expected)
                self.assertIsNotNone(row)
                self.assertEqual(row.attrib["resource-id"], "menu-item-1792488600000")

    def test_history_label_match_is_exact_not_a_numeric_substring(self) -> None:
        root = history_hierarchy("history-entry-sets-completed")

        self.assertIsNone(ko_release_ui.find_completed_history_label(root, "2 × 8 × 120 kg"))

    def test_completed_marker_on_another_card_does_not_validate_incomplete_fixture_row(self) -> None:
        root = history_hierarchy("history-entry-sets-incompleted")
        other = ET.SubElement(root, "node", {"resource-id": "menu-item-other", "content-desc": "unrelated"})
        ET.SubElement(other, "node", {"resource-id": "history-entry-sets-completed"})

        self.assertIsNone(ko_release_ui.find_completed_history_label(root, "2 × 8 × 20 kg"))


if __name__ == "__main__":
    unittest.main()
