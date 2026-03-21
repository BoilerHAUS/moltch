#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

VALID_SEVERITIES = {"sev2", "sev3", "sev4"}
VALID_ACTIONS = {"pause", "investigate", "retry", "escalate"}
REQUIRED_ALERTS = {
    "decision_stuck_age_breach",
    "validation_failures_repeating_by_lane",
    "hold_or_no_go_spike_vs_baseline",
}


def fail(msg: str) -> None:
    raise SystemExit(f"[decision-alert-threshold][fail] {msg}")


def expect(cond: bool, msg: str) -> None:
    if not cond:
        fail(msg)


def main() -> None:
    ap = argparse.ArgumentParser(description="Validate decision alert threshold profile v1")
    ap.add_argument("--input", required=True)
    args = ap.parse_args()

    p = Path(args.input)
    expect(p.exists(), f"input missing: {p}")

    data = json.loads(p.read_text())

    expect(data.get("profile_version") == "decision_alert_threshold_profile.v1", "profile_version must be decision_alert_threshold_profile.v1")
    expect(isinstance(data.get("generated_at_utc"), str) and data["generated_at_utc"].endswith("Z"), "generated_at_utc must be UTC ISO string")
    expect(data.get("owner_role") in {"agent_product_governance", "agent_technical_delivery"}, "owner_role invalid")
    expect(isinstance(data.get("max_auto_retries"), int) and data["max_auto_retries"] >= 0, "max_auto_retries must be integer >= 0")

    alerts = data.get("alerts")
    expect(isinstance(alerts, dict), "alerts must be object")
    expect(REQUIRED_ALERTS.issubset(alerts.keys()), "alerts missing one or more required keys")

    for name in REQUIRED_ALERTS:
        a = alerts[name]
        expect(isinstance(a, dict), f"{name} must be object")
        expect(a.get("severity") in VALID_SEVERITIES, f"{name}.severity invalid")
        expect(a.get("default_next_action") in VALID_ACTIONS, f"{name}.default_next_action invalid")
        expect(isinstance(a.get("fail_closed_required"), bool), f"{name}.fail_closed_required must be bool")
        expect(isinstance(a.get("auto_remediation_allowed"), bool), f"{name}.auto_remediation_allowed must be bool")
        expect(isinstance(a.get("thresholds"), dict), f"{name}.thresholds must be object")

        if name == "decision_stuck_age_breach":
            expect("max_state_age_ms" in a["thresholds"], "decision_stuck_age_breach.thresholds.max_state_age_ms missing")
        elif name == "validation_failures_repeating_by_lane":
            expect("window_minutes" in a["thresholds"], "validation_failures_repeating_by_lane.thresholds.window_minutes missing")
            expect("count_threshold" in a["thresholds"], "validation_failures_repeating_by_lane.thresholds.count_threshold missing")
        elif name == "hold_or_no_go_spike_vs_baseline":
            expect("baseline_multiplier" in a["thresholds"], "hold_or_no_go_spike_vs_baseline.thresholds.baseline_multiplier missing")
            expect("consecutive_windows" in a["thresholds"], "hold_or_no_go_spike_vs_baseline.thresholds.consecutive_windows missing")

    # boundary invariant
    if alerts["decision_stuck_age_breach"].get("severity") == "sev2":
        expect(alerts["decision_stuck_age_breach"].get("auto_remediation_allowed") is False,
               "sev2 decision_stuck_age_breach must not allow auto remediation")

    print(f"[decision-alert-threshold][pass] {p}")


if __name__ == "__main__":
    main()
