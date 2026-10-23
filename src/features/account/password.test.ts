import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordInput } from './password-policy';
test('password policy enforces screenshot policy and rejects reuse', () => {
  for (const newPassword of ['short', 'alllowercase1', 'ALLUPPERCASE1', 'NoDigitsHere', 'CurrentPass1']) {
    assert.equal(passwordInput.safeParse({ currentPassword: 'CurrentPass1', newPassword }).success, false);
  }
  assert.equal(passwordInput.safeParse({ currentPassword: 'CurrentPass1', newPassword: 'DifferentPass2' }).success, true);
  assert.equal(passwordInput.safeParse({ currentPassword: '', newPassword: 'DifferentPass2' }).success, false);
});
