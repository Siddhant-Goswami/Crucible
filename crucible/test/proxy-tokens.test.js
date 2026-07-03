'use strict';
// proxy-tokens.test.js — the metering proxy must recognize every wire shape a harness can emit,
// or that harness reads as unmetered (the codex/openclaw blind spot). Covers Ollama-native,
// OpenAI chat/completions, and the /v1/responses shape (input_tokens/output_tokens), both as a
// single object and as the terminal SSE event with usage nested under `.response.usage`.
const { test } = require('node:test');
const assert = require('node:assert');
const { parseTokens } = require('../proxy/ollama-proxy.js');

const p = s => parseTokens(Buffer.from(s));

test('Ollama native (prompt_eval_count/eval_count)', () => {
  assert.deepStrictEqual(p(JSON.stringify({ model: 'qwen3:8b', prompt_eval_count: 12, eval_count: 34 })),
    { model: 'qwen3:8b', in: 12, out: 34 });
});

test('OpenAI chat/completions (usage.prompt_tokens/completion_tokens)', () => {
  assert.deepStrictEqual(p(JSON.stringify({ model: 'gpt-4o-mini', usage: { prompt_tokens: 100, completion_tokens: 20 } })),
    { model: 'gpt-4o-mini', in: 100, out: 20 });
});

test('/v1/responses non-streaming (usage.input_tokens/output_tokens)', () => {
  assert.deepStrictEqual(p(JSON.stringify({ model: 'qwen3.5:9b', usage: { input_tokens: 55, output_tokens: 7 } })),
    { model: 'qwen3.5:9b', in: 55, out: 7 });
});

test('/v1/responses streaming — usage nested in the terminal response.completed event', () => {
  const sse = [
    'data: {"type":"response.output_text.delta","delta":"h"}',
    'data: {"type":"response.completed","response":{"model":"gpt-5.5","usage":{"input_tokens":900,"output_tokens":120}}}',
    'data: [DONE]',
  ].join('\n');
  assert.deepStrictEqual(p(sse), { model: 'gpt-5.5', in: 900, out: 120 });
});

test('takes the LAST meterable object in an NDJSON stream', () => {
  const nd = [
    JSON.stringify({ usage: { prompt_tokens: 1, completion_tokens: 1 } }),
    JSON.stringify({ usage: { prompt_tokens: 200, completion_tokens: 40 } }),
  ].join('\n');
  assert.deepStrictEqual(p(nd), { model: null, in: 200, out: 40 });
});

test('non-meterable body → null (harness reads as unmetered, not a crash)', () => {
  assert.strictEqual(p('not json at all'), null);
  assert.strictEqual(p(JSON.stringify({ choices: [{ text: 'hi' }] })), null);
});
