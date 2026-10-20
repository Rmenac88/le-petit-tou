import test from 'node:test';
import assert from 'node:assert/strict';
import { onAppEvent, emitAppEvent } from '../appEvents.ts';

test('un abonné reçoit le détail ; le désabonnement fonctionne', () => {
  const got: any[] = [];
  const off = onAppEvent('t1', (e) => got.push(e.detail));
  emitAppEvent('t1', { a: 1 });
  off();
  emitAppEvent('t1', { a: 2 });
  assert.deepEqual(got, [{ a: 1 }]);
});

test('plusieurs abonnés ; événements indépendants', () => {
  let a = 0, b = 0, other = 0;
  const o1 = onAppEvent('t2', () => a++);
  const o2 = onAppEvent('t2', () => b++);
  const o3 = onAppEvent('t3', () => other++);
  emitAppEvent('t2');
  assert.deepEqual([a, b, other], [1, 1, 0]);
  o1(); o2(); o3();
});

test('un abonné qui plante ne bloque pas les autres, et ne lève pas', () => {
  let ok = 0;
  const o1 = onAppEvent('t4', () => { throw new Error('boom'); });
  const o2 = onAppEvent('t4', () => ok++);
  assert.doesNotThrow(() => emitAppEvent('t4'));
  assert.equal(ok, 1);
  o1(); o2();
});

test('émettre sans abonné est sans effet ; se désabonner de nouveau est inoffensif', () => {
  assert.doesNotThrow(() => emitAppEvent('personne', 1));
  const off = onAppEvent('t5', () => {});
  off();
  assert.doesNotThrow(() => off());
});

test('un abonné ajouté pendant la diffusion ne la rend pas infinie', () => {
  let n = 0;
  const offs: Array<() => void> = [];
  offs.push(onAppEvent('t6', () => { n++; offs.push(onAppEvent('t6', () => n++)); }));
  emitAppEvent('t6');
  assert.equal(n, 1);
  offs.forEach((f) => f());
});
