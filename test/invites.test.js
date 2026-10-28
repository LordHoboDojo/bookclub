import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Invite } from '../src/models/index.js';
import { assertUsable, InviteError, parseEmails } from '../src/services/invites.js';

test('parseEmails splits, lowercases, dedupes and separates invalid entries', () => {
  const { valid, invalid } = parseEmails('Ann@Example.com, bob@example.com;ann@example.com\n not-an-email  carol@x.io');
  assert.deepEqual(valid, ['ann@example.com', 'bob@example.com', 'carol@x.io']);
  assert.deepEqual(invalid, ['not-an-email']);
});

test('tokens are random, url-safe, and only their hash is stored', () => {
  const a = Invite.generateToken();
  const b = Invite.generateToken();
  assert.notEqual(a.token, b.token);
  assert.match(a.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(a.tokenHash, Invite.hashToken(a.token));
  assert.notEqual(a.tokenHash, a.token);
});

const inviteFor = (overrides = {}) =>
  new Invite({
    club: new mongoose.Types.ObjectId(),
    email: 'reader@example.com',
    invitedBy: new mongoose.Types.ObjectId(),
    tokenHash: 'h',
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  });

test('assertUsable accepts an open invite for the matching account', () => {
  assert.doesNotThrow(() => assertUsable(inviteFor(), { email: 'reader@example.com' }));
  assert.doesNotThrow(() => assertUsable(inviteFor(), undefined)); // anonymous preview
});

test('assertUsable rejects missing, used, revoked, expired and mismatched invites', () => {
  const user = { email: 'reader@example.com' };
  const cases = [
    [null, /not valid/],
    [inviteFor({ status: 'accepted' }), /already been accepted/],
    [inviteFor({ status: 'revoked' }), /no longer active/],
    [inviteFor({ expiresAt: new Date(Date.now() - 1000) }), /expired/],
  ];
  for (const [invite, message] of cases) {
    assert.throws(() => assertUsable(invite, user), (err) => err instanceof InviteError && message.test(err.message));
  }
  assert.throws(() => assertUsable(inviteFor(), { email: 'someone@else.com' }), /signed in as someone@else.com/);
});
