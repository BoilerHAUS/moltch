import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCAN = ROOT / "scripts" / "ops" / "scan_doc_review_due.py"
PUBLISH = ROOT / "scripts" / "ops" / "publish_doc_review_issue.py"

import sys
sys.path.insert(0, str(ROOT / "scripts" / "ops"))
import publish_doc_review_issue as publisher


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
                "owner_lanes": {
                    "agent_product_governance": {
                        "overdue": [{"path": "docs/x.md", "next_review_due": "2026-03-20", "owner_role": "agent_product_governance"}]
                    }
                },
                "overdue": [],
                "due_this_week": [],
                "missing_metadata": [],
            }), encoding="utf-8")
            result = subprocess.run([
                "python3", str(PUBLISH), "--input", str(path), "--dry-run"
            ], text=True, capture_output=True, check=False)
            self.assertEqual(result.returncode, 0)
            self.assertIn("ops: weekly doc review queue", result.stdout)
            self.assertIn("lane grouping (owner_role)", result.stdout)
            self.assertIn("agent_product_governance", result.stdout)

    def test_upsert_updates_existing_issue_idempotently(self) -> None:
        report = {
            "as_of": "2026-03-21",
            "window_days": 7,
            "owner_lanes": {},
            "overdue": [],
            "due_this_week": [],
            "missing_metadata": [],
        }
        calls: list[list[str]] = []

        def fake_run(cmd: list[str]) -> str:
            calls.append(cmd)
            if cmd[:3] == ["gh", "issue", "list"]:
                return json.dumps([{"number": 777}])
            return "ok"

        action, number = publisher.upsert_weekly_issue(report=report, repo="BoilerHAUS/moltch", run_cmd=fake_run)
        self.assertEqual(action, "updated")
        self.assertEqual(number, "777")
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[1][:3], ["gh", "issue", "edit"])

    def test_upsert_creates_when_missing(self) -> None:
        report = {
            "as_of": "2026-03-21",
            "window_days": 7,
            "owner_lanes": {},
            "overdue": [],
            "due_this_week": [],
            "missing_metadata": [],
        }
        calls: list[list[str]] = []

        def fake_run(cmd: list[str]) -> str:
            calls.append(cmd)
            if cmd[:3] == ["gh", "issue", "list"]:
                return "[]"
            return "ok"

        action, number = publisher.upsert_weekly_issue(report=report, repo="BoilerHAUS/moltch", run_cmd=fake_run)
        self.assertEqual(action, "created")
        self.assertEqual(number, "")
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[1][:3], ["gh", "issue", "create"])


if __name__ == "__main__":
    unittest.main()
