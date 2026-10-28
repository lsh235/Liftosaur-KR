# Manual Smoke Checklist

- Date: 2026-10-28

## Checks
- [ ] TC-001 (low/ui) Where to find it
- [ ] TC-002 (low/ui) Back up all your data
- [ ] TC-003 (low/ui) Export your history as a spreadsheet
- [ ] TC-004 (low/ui) Export your programs as text
- [ ] TC-005 (low/ui) Import history from Hevy
- [x] TC-006 (low/ui) Import history from a Liftosaur CSV
- [x] TC-007 (low/ui) Check the preview before you import
- [x] TC-008 (low/ui) How many workouts will be imported and their date range.
- [x] TC-009 (low/ui) Every workout, drawn the way it will look on the Home screen.
- [ ] TC-010 (low/ui) Which exercises will be created as custom. Tap **Show** to see the names.
- [ ] TC-011 (low/ui) Rows skipped because they could not be parsed, with the row number and the reason.
- [ ] TC-012 (low/ui) Values that look suspicious: a weight over 3000 lb, more than 1000 reps, a date before 2000 or more than a day in the future.
- [ ] TC-013 (low/ui) Workouts that look like duplicates of your existing history. A workout is a duplicate when it starts within one minute of one you already have. Duplicates are skipped by default. Tap **Skipped - Include?** to import them anyway.
- [ ] TC-014 (low/ui) Undo an import
- [ ] TC-015 (low/ui) Restore from a JSON backup
- [ ] TC-016 (low/ui) Import a program from a JSON file
- [ ] TC-017 (low/ui) Read a finished workout
- [ ] TC-018 (low/ui) Move through weeks
- [ ] TC-019 (low/ui) See the week's totals
- [ ] TC-020 (low/ui) Find a workout in the month calendar
- [ ] TC-021 (low/ui) Open and edit a past workout
- [ ] TC-022 (low/ui) Change the date or the length
- [ ] TC-023 (low/ui) Add a note
- [ ] TC-024 (low/ui) Share a workout
- [ ] TC-025 (low/ui) Delete a workout

## Execution notes

- PASS: CSV import preview, workout cards, count/date-range summary, and confirmation in the local Worker app. OAuth and MCP `get_history` returned 2 imported records.
- Other checklist items were not run in this release pass.
