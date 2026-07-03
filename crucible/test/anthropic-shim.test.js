'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { toAnthropic, toOpenAI, toOllama } = require('../proxy/anthropic-shim');

test('toAnthropic: system split out, user/assistant mapped, max_tokens defaulted', () => {
  const a = toAnthropic({ messages: [
    { role: 'system', content: 'be terse' },
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'hello' },
  ] }, 'claude-opus-4-8');
  assert.strictEqual(a.system, 'be terse');
  assert.strictEqual(a.model, 'claude-opus-4-8');
  assert.ok(a.max_tokens > 0);                                  // Anthropic requires max_tokens
  assert.deepStrictEqual(a.messages, [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: [{ type: 'text', text: 'hello' }] },
  ]);
});

test('toAnthropic: OpenAI tools -> Anthropic tools + tool_choice mapping', () => {
  const tools = [{ type: 'function', function: { name: 'run', description: 'run it', parameters: { type: 'object', properties: { cmd: { type: 'string' } } } } }];
  const auto = toAnthropic({ messages: [{ role: 'user', content: 'x' }], tools }, 'm');
  assert.deepStrictEqual(auto.tools, [{ name: 'run', description: 'run it', input_schema: { type: 'object', properties: { cmd: { type: 'string' } } } }]);
  assert.deepStrictEqual(auto.tool_choice, { type: 'auto' });
  assert.deepStrictEqual(toAnthropic({ messages: [], tools, tool_choice: 'required' }, 'm').tool_choice, { type: 'any' });
  assert.deepStrictEqual(toAnthropic({ messages: [], tools, tool_choice: { type: 'function', function: { name: 'run' } } }, 'm').tool_choice, { type: 'tool', name: 'run' });
  assert.strictEqual(toAnthropic({ messages: [], tools, tool_choice: 'none' }, 'm').tools, undefined);   // 'none' forbids tools
});

test('toAnthropic: assistant tool_calls + tool results round-trip into content blocks', () => {
  const a = toAnthropic({ messages: [
    { role: 'user', content: 'do it' },
    { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'run', arguments: '{"cmd":"ls"}' } }] },
    { role: 'tool', tool_call_id: 'call_1', content: 'file.txt' },
  ] }, 'm');
  // assistant turn carries a tool_use block with PARSED input
  assert.deepStrictEqual(a.messages[1], { role: 'assistant', content: [{ type: 'tool_use', id: 'call_1', name: 'run', input: { cmd: 'ls' } }] });
  // tool result becomes a user turn with a tool_result block keyed by tool_use_id
  assert.deepStrictEqual(a.messages[2], { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_1', content: 'file.txt' }] });
});

test('toOpenAI: tool_use response -> tool_calls + finish_reason tool_calls', () => {
  const resp = { id: 'msg_1', model: 'claude-opus-4-8', stop_reason: 'tool_use',
    content: [{ type: 'text', text: 'let me run that' }, { type: 'tool_use', id: 'tu_1', name: 'run', input: { cmd: 'ls' } }],
    usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 5 } };
  const o = toOpenAI(resp, 'claude-opus-4-8');
  assert.strictEqual(o.choices[0].finish_reason, 'tool_calls');
  assert.strictEqual(o.choices[0].message.content, 'let me run that');
  assert.deepStrictEqual(o.choices[0].message.tool_calls, [{ id: 'tu_1', type: 'function', function: { name: 'run', arguments: '{"cmd":"ls"}' } }]);
  assert.deepStrictEqual(o.usage, { prompt_tokens: 105, completion_tokens: 20, total_tokens: 125 });   // cache counted at full rate
});

test('toOpenAI: plain text response -> finish_reason stop, no tool_calls', () => {
  const o = toOpenAI({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'done' }], usage: { input_tokens: 3, output_tokens: 1 } }, 'm');
  assert.strictEqual(o.choices[0].finish_reason, 'stop');
  assert.strictEqual(o.choices[0].message.content, 'done');
  assert.strictEqual(o.choices[0].message.tool_calls, undefined);
});

test('toOllama: tool_use -> Ollama tool_calls with OBJECT arguments (not a JSON string)', () => {
  const oll = toOllama({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't', name: 'run', input: { cmd: 'ls' } }], usage: { input_tokens: 2, output_tokens: 4 } }, 'm');
  assert.deepStrictEqual(oll.message.tool_calls, [{ function: { name: 'run', arguments: { cmd: 'ls' } } }]);
  assert.strictEqual(oll.prompt_eval_count, 2);
  assert.strictEqual(oll.eval_count, 4);
  assert.strictEqual(oll.done, true);
});
