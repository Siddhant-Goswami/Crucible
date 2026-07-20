# tb-schemelike-metacircular-eval

> Imported from **Terminal-Bench (schemelike-metacircular-eval)** via crucible/tools/import-task.js

Write a file eval.scm that is a metacircular evaluator for the scheme-like language implemented by interp.py (provided in the current directory). The eval.scm file should read exactly one line from STDIN, which is a file path to a .scm file that should be interpreted. Remaining input should be redirected to the interpreted program, and any output from the program should be sent back to STDOUT.

Your interpreter should be able to interpret each of the example test programs in test/. For example:
  echo '(+ 7 8)' | python3 interp.py test/calculator.scm
and
  echo -e 'test/calculator.scm\n(+ 7 8)' | python3 interp.py eval.scm
should do the same thing.

Note: the example programs in test/ are shown for reference; your eval.scm is graded against a held-out set of programs in the same language.

Rules: edit only the source/artifact files the task needs. Do NOT edit test files, `verify.sh`, or `TASK.md`.
