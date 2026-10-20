# Backup and restore

What is stored: two append-only files in `DATA_DIR`: `events.jsonl` (anonymous counters) and `waitlist.jsonl` (optional emails). Nothing else.

**Back up:** copy both files while the app runs (appends are single lines, so a copy taken mid-write can end in a torn last line, which the app skips). Store the copy somewhere private; `waitlist.jsonl` holds email addresses.

**Restore:** stop the app, put both files back in `DATA_DIR` (mode 0600), start the app. Counts and the waitlist are rebuilt from the files.

**Delete a person on request:** remove their line from `waitlist.jsonl`, then restart the app (the in-memory copy is rebuilt from the file).

**When the test ends:** delete `waitlist.jsonl` on the end date stated in the notice.

A restore into a separate directory is proven by the test "a copy of the data directory restores identical counts and waitlist" in `tests/permissions.test.js`.
