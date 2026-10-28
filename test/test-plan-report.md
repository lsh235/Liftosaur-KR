# Test Plan Report

- Generated at (UTC): `2026-10-28 00:01:37`
- Source mode: fallback docs/features markdown -> normalized test cases
- Specs used:
  - `docs/features/import-export.md`
  - `docs/features/workout-history.md`

## Traceability

| ID | Priority | Category | Type | Source | Scenario | Status |
|---|---|---|---|---|---|---|
| TC-001 | low | ui | functional | `docs/features/import-export.md` | Where to find it | NOT RUN |
| TC-002 | low | ui | functional | `docs/features/import-export.md` | Back up all your data | NOT RUN |
| TC-003 | low | ui | functional | `docs/features/import-export.md` | Export your history as a spreadsheet | NOT RUN |
| TC-004 | low | ui | functional | `docs/features/import-export.md` | Export your programs as text | NOT RUN |
| TC-005 | low | ui | functional | `docs/features/import-export.md` | Import history from Hevy | NOT RUN |
| TC-006 | low | ui | functional | `docs/features/import-export.md` | Import history from a Liftosaur CSV | PASS |
| TC-007 | low | ui | functional | `docs/features/import-export.md` | Check the preview before you import | PASS |
| TC-008 | low | ui | functional | `docs/features/import-export.md` | How many workouts will be imported and their date range. | PASS |
| TC-009 | low | ui | functional | `docs/features/import-export.md` | Every workout, drawn the way it will look on the Home screen. | PASS |
| TC-010 | low | ui | functional | `docs/features/import-export.md` | Which exercises will be created as custom. Tap **Show** to see the names. | NOT RUN |
| TC-011 | low | ui | functional | `docs/features/import-export.md` | Rows skipped because they could not be parsed, with the row number and the reason. | NOT RUN |
| TC-012 | low | ui | functional | `docs/features/import-export.md` | Values that look suspicious: a weight over 3000 lb, more than 1000 reps, a date before 2000 or more than a day in the future. | NOT RUN |
| TC-013 | low | ui | functional | `docs/features/import-export.md` | Workouts that look like duplicates of your existing history. A workout is a duplicate when it starts within one minute of one you already have. Duplicates are skipped by default. Tap **Skipped - Include?** to import them anyway. | NOT RUN |
| TC-014 | low | ui | functional | `docs/features/import-export.md` | Undo an import | NOT RUN |
| TC-015 | low | ui | functional | `docs/features/import-export.md` | Restore from a JSON backup | NOT RUN |
| TC-016 | low | ui | functional | `docs/features/import-export.md` | Import a program from a JSON file | NOT RUN |
| TC-017 | low | ui | functional | `docs/features/workout-history.md` | Read a finished workout | NOT RUN |
| TC-018 | low | ui | functional | `docs/features/workout-history.md` | Move through weeks | NOT RUN |
| TC-019 | low | ui | functional | `docs/features/workout-history.md` | See the week's totals | NOT RUN |
| TC-020 | low | ui | functional | `docs/features/workout-history.md` | Find a workout in the month calendar | NOT RUN |
| TC-021 | low | ui | functional | `docs/features/workout-history.md` | Open and edit a past workout | NOT RUN |
| TC-022 | low | ui | functional | `docs/features/workout-history.md` | Change the date or the length | NOT RUN |
| TC-023 | low | ui | functional | `docs/features/workout-history.md` | Add a note | NOT RUN |
| TC-024 | low | ui | functional | `docs/features/workout-history.md` | Share a workout | NOT RUN |
| TC-025 | low | ui | functional | `docs/features/workout-history.md` | Delete a workout | NOT RUN |

## Execution Notes

- PASS: The supplied CSV completed the Settings > Liftosaur history CSV import preview and confirmation in the local Cloudflare Worker app. OAuth authorization and MCP `get_history` returned the imported records. See `test-result-template.md` for command and runtime evidence.
- Remaining cases are NOT RUN; the focused release request covered the CSV import/history-read path.
