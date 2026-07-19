# tb-jsonl-aggregator

> Imported from **Terminal-Bench (jsonl-aggregator)** via crucible/tools/import-task.js

There are multiple JSONL files located in the current directory: records_1.jsonl, records_2.jsonl, ..., records_5.jsonl.
Each line is a JSON object with keys: "user" (string), "amount" (number), "items" (integer), "tags" (array of strings).
Aggregate the data across all these files and create 'aggregates.json' with exactly the following structure:

{
  "top_5_users_by_amount": {
    "<user>": {"total_amount": <float, 2 decimals>, "total_items": <int>},
    ... (exactly 5 users, the 5 with the greatest summed amount)
  },
  "top_5_tags_by_count": {
    "<tag>": {"count": <int>},
    ... (exactly 5 tags, the 5 most frequent)
  }
}

'total_amount' is the sum of that user's 'amount' across all records, rounded to 2 decimal places. 'total_items' is the sum of that user's 'items'. Tag counts are the number of records in which each tag appears (summed over occurrences in the tags arrays).

Rules: edit only the source/artifact files the task needs. Do NOT edit test files, `verify.sh`, or `TASK.md`.
