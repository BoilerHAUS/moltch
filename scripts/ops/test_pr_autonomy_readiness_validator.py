import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "ops" / "validate_pr_autonomy_readiness.py"
FIXTURE_DIR = ROOT / "scripts" / "ops" / "fixtures" / "pr_autonomy"


class PRAutonomyReadinessValidatorTest(unittest.TestCase):
    def run_validator(self, fixture_name: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", str(SCRIPT), "--input", str(FIXTURE_DIR / fixture_name)],
            text=True,
            capture_output=True,
            check=False,
            cwd=ROOT,
        )

    def test_valid_fixture_passes(self) -> None:
        result = self.run_validator("pr_autonomy_readiness_valid_v1.json")
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("[pr-autonomy][pass]", result.stdout)

    def test_ready_requires_all_signals(self) -> None:
        result = self.run_validator("pr_autonomy_readiness_invalid_missing_signals_v1.json")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("ready=true requires all readiness signals to be true", result.stderr)

    def test_auto_pr_opened_requires_pr_url(self) -> None:
        result = self.run_validator("pr_autonomy_readiness_invalid_auto_pr_missing_url_v1.json")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("auto_pr_opened requires existing_pr_url", result.stderr)


if __name__ == "__main__":
    unittest.main()
