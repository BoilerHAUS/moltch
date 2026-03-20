import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "ops" / "reconcile_roadmap_open_issues.py"

ns: dict[str, object] = {}
exec(SCRIPT.read_text(encoding="utf-8"), ns)
run_gh_json = ns["run_gh_json"]


class RoadmapOpenIssueReconcilerTest(unittest.TestCase):
    def run_reconciler(self, trigger_mode: str, artifact_dir: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                "python3",
                str(SCRIPT),
                "--roadmap",
                str(ROOT / "scripts" / "ops" / "fixtures" / "roadmap_reconciler" / "ROADMAP_V1.fixture.md"),
                "--issues-json",
                str(ROOT / "scripts" / "ops" / "fixtures" / "roadmap_reconciler" / "open_issues.fixture.json"),
                "--trigger-mode",
                trigger_mode,
                "--artifact-dir",
                str(artifact_dir),
                "--generated-at-utc",
                "2026-03-20T00:00:00Z",
            ],
            text=True,
            capture_output=True,
            check=False,
            cwd=ROOT,
        )

    def test_pre_merge_artifact_marks_blocking_drift(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            artifact_dir = Path(temp_dir)
            result = self.run_reconciler("pre-merge", artifact_dir)
            self.assertEqual(result.returncode, 0, msg=result.stderr)

            artifact_path = artifact_dir / "roadmap_open_issue_reconciliation.pre-merge.20260320T000000Z.json"
            self.assertTrue(artifact_path.exists())

            report = json.loads(artifact_path.read_text(encoding="utf-8"))
            self.assertEqual(report["metrics"]["actionable_finding_count"], 5)
            self.assertIn(
                "block_merge",
                {finding["action_classification"]["action"] for finding in report["findings"]},
            )
            self.assertEqual(
                {
                    finding["drift_class"]
                    for finding in report["findings"]
                },
                {
                    "duplicate_mapping_rows",
                    "missing_open_issue_tracking",
                    "overlap_mapped_and_excluded",
                    "stale_exclusion_closed_issue",
                    "stale_mapping_closed_issue",
                },
            )

    def test_post_merge_check_exits_non_zero_and_marks_follow_up(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            artifact_dir = Path(temp_dir)
            result = subprocess.run(
                [
                    "python3",
                    str(SCRIPT),
                    "--roadmap",
                    str(ROOT / "scripts" / "ops" / "fixtures" / "roadmap_reconciler" / "ROADMAP_V1.fixture.md"),
                    "--issues-json",
                    str(ROOT / "scripts" / "ops" / "fixtures" / "roadmap_reconciler" / "open_issues.fixture.json"),
                    "--trigger-mode",
                    "post-merge",
                    "--artifact-dir",
                    str(artifact_dir),
                    "--generated-at-utc",
                    "2026-03-20T00:00:00Z",
                    "--check",
                ],
                text=True,
                capture_output=True,
                check=False,
                cwd=ROOT,
            )
            self.assertEqual(result.returncode, 2, msg=result.stderr)

            artifact_path = artifact_dir / "roadmap_open_issue_reconciliation.post-merge.20260320T000000Z.json"
            self.assertTrue(artifact_path.exists())

            report = json.loads(artifact_path.read_text(encoding="utf-8"))
            self.assertTrue(all(finding["action_classification"]["action"] == "post_merge_follow_up" for finding in report["findings"]))
            self.assertTrue(report["follow_ups"])

    def test_run_gh_json_aggregates_paginated_jq_output_safely(self) -> None:
        paginated_output = '\n'.join([
            json.dumps({"number": 1, "title": "first"}),
            json.dumps({"number": 2, "title": "second"}),
        ]) + '\n'

        with mock.patch("subprocess.check_output", return_value=paginated_output) as check_output:
            payload = run_gh_json("BoilerHAUS/moltch")

        self.assertEqual(payload, [
            {"number": 1, "title": "first"},
            {"number": 2, "title": "second"},
        ])
        called_args = check_output.call_args.args[0]
        self.assertIn("--paginate", called_args)
        self.assertIn("--jq", called_args)


if __name__ == "__main__":
    unittest.main()
