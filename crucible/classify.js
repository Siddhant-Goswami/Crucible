'use strict';
// classify.js — map a run's trajectory to the execution-alignment failure taxonomy (P1).
// Harness-Bench's five modes: contract/format, tool/recovery, evidence/grounding,
// artifact-commitment, state/continuation. Heuristic and deterministic (no LLM judge);
// its rules are documented so the labels are criticizable, not oracular.
//
// classify(result, trace) -> one of the enum strings, or null when the run passed.

const RX = {
  contract_format: /\b(json|schema|parse|malformed|invalid|format|syntax|unexpected token|not valid)\b/i,
  evidence_grounding: /\b(source|cite|citation|url|coverage|topic not covered|unsupported|reference)\b/i,
  state_continuation: /\b(missing|lost|not preserved|regress|incomplete|resume|continue)\b/i,
};

function classify(result, trace) {
  if (result === 'passed') return null;

  const lastFb = [...trace].reverse().find(t => t.feedback_digest)?.feedback_digest || '';
  const anyWrite = trace.some(t => (t.files_written || []).length > 0);
  const toolErrors = trace.some(t => (t.events || []).some(e => e.type === 'tool_error'));
  const checkpoints = trace.map(t => t.checkpoints_hit).filter(v => typeof v === 'number');
  const regressed = checkpoints.some((v, i) => i > 0 && v < checkpoints[i - 1]);

  // 1. Reasoned but never committed an artifact — the agent talked, didn't act.
  if (!anyWrite) return 'artifact_commitment';
  // 2. Progress was made then lost across iterations.
  if (regressed) return 'state_continuation';
  // 3. Output-contract / format violations (malformed JSON, schema misses).
  if (RX.contract_format.test(lastFb)) return 'contract_format';
  // 4. Evidence / grounding gaps (missing citations, uncovered topics).
  if (RX.evidence_grounding.test(lastFb)) return 'evidence_grounding';
  // 5. Tool errors without effective recovery.
  if (toolErrors) return 'tool_recovery';
  // 6. State/continuation language in the last feedback.
  if (RX.state_continuation.test(lastFb)) return 'state_continuation';
  // Default: ran out of budget still iterating on the gate — a recovery failure.
  return 'tool_recovery';
}

module.exports = { classify, RX };
