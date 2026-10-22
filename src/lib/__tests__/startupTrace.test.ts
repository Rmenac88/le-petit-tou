import test from 'node:test';
import assert from 'node:assert/strict';
import { mark, startupReport } from '../startupTrace.ts';

test('un repère n’est enregistré qu’une fois et le rapport liste les temps dans l’ordre', () => {
  mark('a');
  mark('b');
  mark('a');
  const lines = startupReport().split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^\d+\.\d s {2}a$/);
  assert.match(lines[1], /^\d+\.\d s {2}b$/);
});
