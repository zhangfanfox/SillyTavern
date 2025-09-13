import assert from 'node:assert';
import { createEmptySTChat, serializeToJSONL, parseFromJSONL } from '../src/services/chat-serialization';

// Build a dummy chat
const chat = createEmptySTChat('Alice', 'Bob');
chat.messages.push(
  { name: 'Alice', is_user: true, send_date: Date.now(), mes: '你好 Bob' },
  { name: 'Bob', is_user: false, send_date: Date.now(), mes: '你好 Alice', extra: { display_text: '你好 Alice ✅' } },
);

// Serialize
const jsonl = serializeToJSONL(chat);
assert(jsonl.split('\n').length === 3, 'JSONL should have 3 lines');

// Parse
const parsed = parseFromJSONL(jsonl);
assert(parsed, 'Parsed chat should not be null');
assert(parsed!.header.user_name === 'Alice', 'Header user name should be Alice');
assert(parsed!.header.character_name === 'Bob', 'Header character name should be Bob');
assert(parsed!.messages.length === 2, 'Should have 2 messages');
assert(parsed!.messages[1].extra?.display_text === '你好 Alice ✅', 'extra.display_text should round-trip');

console.log('ST JSONL serialize/parse test: PASS');
