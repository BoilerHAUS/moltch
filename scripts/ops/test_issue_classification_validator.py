import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "ops" / "validate_issue_classification.py"
FIXTURE_DIR = ROOT / "scripts" / "ops" / "fixtures" / "issue_classification"


class IssueClassificationValidatorTest(unittest.TestCase):
    def run_validator(self, fixture_name: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                "python3",
                str(SCRIPT),
                "--roadmap",
                str(FIXTURE_DIR / "ROADMAP_V1.fixture.md"),
                "--input",
                str(FIXTURE_DIR / fixture_name),
            ],
            text=True,
            capture_output=True,
            check=False,
            cwd=ROOT,
        )

    def test_valid_fixture_passes(self) -> None:
        result = self.run_validator("issue_classification_status_valid_v1.json")
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("[issue-classification][pass]", result.stdout)

    def test_pr_existence_does_not_imply_admission(self) -> None:
        result = self.run_validator("issue_classification_status_invalid_pr_existence_v1.json")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("PR existence does not satisfy readiness", result.stderr)

    def test_auto_classification_is_conservative_only(self) -> None:
        result = self.run_validator("issue_classification_status_invalid_auto_active_v1.json")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("active_delivery for issue #195 must be manual", result.stderr)


if __name__ == "__main__":
    unittest.main()
