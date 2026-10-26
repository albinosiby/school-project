import 'live_class_models.dart';

/// Google Meet rules of docs/DATA_CONTRACT.md §6. Pure functions so they are easy to test.

final _meetCode = RegExp(r'^(?:https?://)?meet\.google\.com/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:[?#/].*)?$', caseSensitive: false);
final _meetLookup = RegExp(r'^(?:https?://)?meet\.google\.com/lookup/([A-Za-z0-9_-]+)(?:[?#].*)?$', caseSensitive: false);

/// Null when [input] is a valid Meet link (`https://meet.google.com/xxx-xxxx-xxx` or `meet.google.com/lookup/...`), else the inline error.
String? validateMeetLink(String? input) {
  final s = (input ?? '').trim();
  if (s.isEmpty) return 'Paste the Google Meet link';
  return normalizeMeetLink(s) == null ? 'Use a Google Meet link like https://meet.google.com/abc-defg-hij' : null;
}

/// The https form of a valid Meet link (code lower-cased, query dropped), or null if [input] is not one.
String? normalizeMeetLink(String input) {
  final s = input.trim();
  final code = _meetCode.firstMatch(s);
  if (code != null) return 'https://meet.google.com/${code.group(1)!.toLowerCase()}';
  final lookup = _meetLookup.firstMatch(s);
  if (lookup != null) return 'https://meet.google.com/lookup/${lookup.group(1)}';
  return null;
}

/// Where a session is on the clock. [open] = Join is enabled (10 minutes before start until start + mins).
enum LivePhase { draft, scheduled, open, ended }

const joinLeadMinutes = 10;

DateTime? startOf(LiveSession s) => DateTime.tryParse('${s.date}T${s.time.length == 5 ? '${s.time}:00' : s.time}');

extension LiveSessionClock on LiveSession {
  DateTime? get start => startOf(this);
  DateTime? get end => start?.add(Duration(minutes: mins));
  DateTime? get joinOpensAt => start?.subtract(const Duration(minutes: joinLeadMinutes));

  /// Derived from the clock, not from the stored `status` (which can be stale). Drafts stay drafts.
  LivePhase phase(DateTime now) {
    if (isDraft) return LivePhase.draft;
    final s = start, e = end;
    if (s == null || e == null) return status == LiveStatus.past ? LivePhase.ended : LivePhase.scheduled;
    if (!now.isBefore(e)) return LivePhase.ended;
    if (!now.isBefore(s.subtract(const Duration(minutes: joinLeadMinutes)))) return LivePhase.open;
    return LivePhase.scheduled;
  }

  bool canJoin(DateTime now) => phase(now) == LivePhase.open;

  /// "Starts in 2h 5m", "Live now", "Ended".
  String statusLabel(DateTime now) {
    switch (phase(now)) {
      case LivePhase.draft:
        return 'Draft';
      case LivePhase.ended:
        return 'Ended';
      case LivePhase.open:
        return now.isBefore(start!) ? 'Starts in ${_dur(start!.difference(now))}' : 'Live now';
      case LivePhase.scheduled:
        return 'Starts in ${_dur(start!.difference(now))}';
    }
  }
}

String _dur(Duration d) {
  final m = d.inMinutes + (d.inSeconds % 60 > 0 ? 1 : 0);
  if (m >= 1440) return '${m ~/ 1440}d ${(m % 1440) ~/ 60}h';
  if (m >= 60) return '${m ~/ 60}h ${m % 60}m';
  return '${m < 1 ? 1 : m}m';
}

/// Message shared to WhatsApp: title, class, time and the Meet link.
String shareMessage(LiveSession s, {required String className, required String when}) =>
    '${s.title}\nClass: $className\nTime: $when\nJoin on Google Meet: ${s.link}';

/// `https://wa.me/?text=...` link that opens WhatsApp's contact picker with [message].
Uri whatsappShareUri(String message) => Uri.https('wa.me', '/', {'text': message});
