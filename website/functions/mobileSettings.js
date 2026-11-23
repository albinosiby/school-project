const names = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
// The dashboard's "Working week" is free text: a range ("Mon – Sat", "Sun to Thu"), a list ("Mon, Wed, Fri"), optionally
// followed by a note such as "(2nd & 4th Saturday Off)". The range wins wherever it appears; notes in brackets are ignored,
// so "Mon – Sat (2nd & 4th Saturday Off)" is Monday to Saturday, not just Monday and Saturday.
function workingDays(value) {
  const text = String(value || 'Mon – Sat').trim().toLowerCase().replace(/\([^)]*\)/g, ' ');
  const day = token => names.indexOf(token.slice(0, 3)) + 1;
  const range = /\b([a-z]{3,})\s*(?:-|–|—|to)\s*([a-z]{3,})\b/.exec(text);
  if (range && day(range[1]) && day(range[2])) {
    const result = [day(range[1])];
    while (result.at(-1) !== day(range[2]) && result.length < 7) result.push(result.at(-1) % 7 + 1);
    return result;
  }
  const days = [...new Set((text.match(/[a-z]+/g) || []).map(day).filter(Boolean))];
  return days.length ? days : [1,2,3,4,5,6];
}
function utcOffsetMinutes(zone, now = new Date()) {
  const display = /(?:UTC|GMT)\s*([+-])(\d{1,2}):(\d{2})/.exec(zone);
  if (display) return (display[1] === '-' ? -1 : 1) * (Number(display[2]) * 60 + Number(display[3]));
  try {
    const value = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value;
    const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(value || '');
    return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] || 0)) : 0;
  } catch { return 330; }
}
module.exports = { workingDays, utcOffsetMinutes };
