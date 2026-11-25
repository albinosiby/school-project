const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reminderKey, startOf } = require('./classReminders');

const start = startOf('2026-11-26', '15:00'); // 3 PM India time
const ist = (hhmm, day = '2026-11-26') => startOf(day, hhmm);

test('start time is read as India time', () => {
  assert.equal(new Date(start).toISOString(), '2026-11-26T09:30:00.000Z');
});

test('morning reminder from 07:00 on the day, the 1-hour one in the last hour, nothing after the start', () => {
  assert.equal(reminderKey(start, ist('22:00', '2026-11-25')), null, 'the evening before');
  assert.equal(reminderKey(start, ist('06:55')), null, 'before 7 AM');
  assert.equal(reminderKey(start, ist('07:00')), 'day');
  assert.equal(reminderKey(start, ist('13:30')), 'day');
  assert.equal(reminderKey(start, ist('14:05')), 'h1');
  assert.equal(reminderKey(start, ist('14:59')), 'h1');
  assert.equal(reminderKey(start, ist('15:00')), null, 'started');
});

test('a meeting before 8 AM gets only the 1-hour reminder', () => {
  const early = startOf('2026-11-26', '07:30');
  assert.equal(reminderKey(early, ist('07:00')), 'h1');
});
