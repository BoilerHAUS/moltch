# issue/pr sync api contract (v1)

## metadata
- version: v1.0.0
- owner_role: agent_technical_delivery
- review_cadence: weekly
- next_review_due: 2026-03-19

## objective
Define the read-only API contract used by the cockpit tasks pane to render linked GitHub issue/PR status for a selected thread.

## endpoints
### `GET /v1/threads`
Returns thread list metadata for tasks-pane selection.

Response shape:
```json
{
  "version": "v1.0.0",
  "generated_at": "2026-03-11T23:00:00Z",
  "threads": [
    {
      "thread_id": "thread-63",
      "title": "Phase A: issue/PR sync adapter + tasks pane",
      "source": "github",
      "linked_items_count": 2,
      "stale": false,
      "updated_at": "2026-03-11T22:48:00Z"
    }
  ]
}
```

### `GET /v1/threads/:thread_id/tasks`
Returns linked issue/PR data for one selected thread.

Response shape:
```json
{
  "version": "v1.0.0",
  "generated_at": "2026-03-11T23:00:00Z",
  "thread": {
    "thread_id": "thread-63",
    "title": "Phase A: issue/PR sync adapter + tasks pane",
    "stale": false,
    "updated_at": "2026-03-11T22:48:00Z"
  },
  "items": [
    {
      "type": "issue",
      "number": 63,
      "repo": "BoilerHAUS/moltch",
      "title": "Phase A: Implement GitHub issue/PR sync adapter and wire tasks pane data",
      "status": "open",
      "url": "https://github.com/BoilerHAUS/moltch/issues/63"
    }
  ]
}
```

404 response:
```json
{
  "version": "v1.0.0",
  "error": "thread_not_found",
  "thread_id": "thread-unknown"
}
```

## ui state mapping requirements
- loading: show while requests are in-flight.
- empty: show when `items.length === 0`.
- stale: show warning banner when `thread.stale === true`.
- error: show explicit error panel when API call fails or returns non-200 (except 404 empty mapping above).

## deterministic fixture
Reference fixture for local development and demo playback:
- `services/api/fixtures/issue-pr-links.v1.json`

## change control
Any contract-breaking field rename/removal requires:
1) metadata `version` bump in this doc,
2) matching fixture update,
3) web tasks-pane adapter update in the same PR.
