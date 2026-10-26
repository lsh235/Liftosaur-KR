import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify_native_upgrade_evidence import required_evidence_files, verify_evidence


class NativeUpgradeEvidenceTests(unittest.TestCase):
    def test_candidate_version_is_dynamic_and_baseline_stays_v158(self):
        required = required_evidence_files("160.0")
        self.assertIn("v158-package.txt", required)
        self.assertIn("v160.0-package.txt", required)
        self.assertIn("v160.0-primary-measurement.xml", required)
        self.assertIn("v160.0-workout-font-scale-1_3.png", required)
        self.assertNotIn("v159-package.txt", required)

    def test_checker_accepts_complete_arbitrary_candidate_set(self):
        with tempfile.TemporaryDirectory() as temporary_dir:
            output_dir = Path(temporary_dir)
            for name in required_evidence_files("160.0"):
                (output_dir / name).write_text("evidence", encoding="utf-8")
            verify_evidence("160.0", output_dir)

    def test_checker_rejects_missing_candidate_file(self):
        with tempfile.TemporaryDirectory() as temporary_dir:
            with self.assertRaisesRegex(FileNotFoundError, "v160.0-package.txt"):
                verify_evidence("160.0", Path(temporary_dir))

    def test_workflow_uses_verified_tag_version_and_pins_manual_c5_metadata(self):
        workflow = (Path(__file__).resolve().parents[2] / ".github/workflows/android-apk-release.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("CANDIDATE_VERSION: ${{ steps.verify_apk.outputs.release_version }}", workflow)
        self.assertIn('CANDIDATE_VERSION: "159.0"', workflow)
        self.assertIn('EXPECTED_VERSION_CODE="159"', workflow)
        self.assertIn('EXPECTED_VERSION_NAME="159.0"', workflow)
        self.assertIn("40ddf3a343313e904eb2684006520517a9bb395965f9d750da96f0b6cf68f699", workflow)
        self.assertIn("${VERSION} 업데이트와 화면 읽기를 시도합니다", workflow)


if __name__ == "__main__":
    unittest.main()
