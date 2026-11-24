const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dueReminder } = require('./chatMeetings');

const H = 3600e3, M = 60e3;
// 2026-11-24 15:00 IST = 09:30 UTC
const start = Date.parse('2026-11-24T09:30:00Z');

test('meeting reminders fire once each: morning of the day, one hour before, ten minutes before', () => {
  assert.equal(dueReminder(start, start - 20 * H), null, 'the evening before: nothing');
  assert.equal(dueReminder(start, Date.parse('2026-11-24T01:00:00Z')), null, '06:30 IST is before the morning hour');
  assert.equal(dueReminder(start, Date.parse('2026-11-24T02:00:00Z')), 'day', '07:30 IST: morning reminder');
  assert.equal(dueReminder(start, Date.parse('2026-11-24T02:00:00Z'), { day: true }), null, 'already sent');
  assert.equal(dueReminder(start, start - 45 * M), 'h1');
  assert.equal(dueReminder(start, start - 45 * M, { h1: true }), null);
  assert.equal(dueReminder(start, start - 5 * M), 'm10');
  assert.equal(dueReminder(start, start + 1), null, 'started: nothing more');
});
