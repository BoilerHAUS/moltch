import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "ops" / "validate_context_boundary_handoff.py"
FIXTURE_DIR = ROOT / "scripts" / "ops" / "fixtures" / "context_boundary"


class ContextBoundaryHandoffValidatorTest(unittest.TestCase):
    def run_validator(self, fixture_name: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", str(SCRIPT), "--input", str(FIXTURE_DIR / fixture_name)],
            text=True,
            capture_output=True,
            check=False,
            cwd=ROOT,
        )

    def test_valid_fixture_passes(self) -> None:
        result = self.run_validator("handoff_valid_v1.json")
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("[context-boundary][pass]", result.stdout)

    def test_invalid_crossing_is_rejected(self) -> None:
        result = self.run_validator("handoff_invalid_denied_crossing_v1.json")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("deny-by-default crossing not allowed", result.stderr)

    def test_invalid_promotion_is_rejected(self) -> None:
        result = self.run_validator("handoff_invalid_promotion_v1.json")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cannot be promoted to native/shared truth", result.stderr)


if __name__ == "__main__":
    unittest.main()
