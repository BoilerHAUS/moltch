import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCAN = ROOT / "scripts" / "ops" / "scan_doc_review_due.py"
PUBLISH = ROOT / "scripts" / "ops" / "publish_doc_review_issue.py"


class DocReviewAutomationTest(unittest.TestCase):
    def test_scanner_classifies_docs(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            docs = Path(td) / "docs"
            docs.mkdir(parents=True)
            (docs / "a.md").write_text(
                "# a\n\n## metadata\n- owner_role: agent_product_governance\n- review_cadence: weekly\n- next_review_due: 2026-03-20\n",
                encoding="utf-8",
            )
            (docs / "b.md").write_text(
                "# b\n\n## metadata\n- owner_role: agent_technical_delivery\n- review_cadence: weekly\n- next_review_due: 2026-03-25\n",
                encoding="utf-8",
            )
            (docs / "c.md").write_text("# c\n", encoding="utf-8")

            out = Path(td) / "report.json"
            subprocess.check_call([
                "python3", str(SCAN), "--root", str(docs), "--as-of", "2026-03-21", "--window-days", "7", "--output-json", str(out)
            ])
            report = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(report["metrics"]["overdue_count"], 1)
            self.assertEqual(report["metrics"]["due_this_week_count"], 1)
            self.assertEqual(report["metrics"]["missing_metadata_count"], 1)

    def test_publish_dry_run_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "report.json"
            path.write_text(json.dumps({
                "as_of": "2026-03-21",
                "window_days": 7,
                "overdue": [],
                "due_this_week": [],
                "missing_metadata": [],
            }), encoding="utf-8")
            result = subprocess.run([
                "python3", str(PUBLISH), "--input", str(path), "--dry-run"
            ], text=True, capture_output=True, check=False)
            self.assertEqual(result.returncode, 0)
            self.assertIn("ops: weekly doc review queue", result.stdout)


if __name__ == "__main__":
    unittest.main()
