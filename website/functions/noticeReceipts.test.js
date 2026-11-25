const { test } = require('node:test');
const assert = require('node:assert/strict');
const { receiptChange } = require('./noticeReceipts');

const at = '2026-11-25T08:00:00.000Z';

test('the first read counts once; opening it again counts nothing', () => {
  assert.deepEqual(receiptChange(null, { read: true, at }), { receipt: { readAt: at }, read: 1, acked: 0 });
  assert.equal(receiptChange({ readAt: at }, { read: true, at }), null);
});

test('acknowledging counts the ack, and the read too when it was never read', () => {
  assert.deepEqual(receiptChange(null, { ack: true, at }), { receipt: { readAt: at, ackAt: at }, read: 1, acked: 1 });
  assert.deepEqual(receiptChange({ readAt: 'earlier' }, { ack: true, at }), { receipt: { ackAt: at }, read: 0, acked: 1 });
  assert.equal(receiptChange({ readAt: 'earlier', ackAt: 'earlier' }, { ack: true, read: true, at }), null);
});

test('nothing new is no change', () => {
  assert.equal(receiptChange({}, { at }), null);
});
