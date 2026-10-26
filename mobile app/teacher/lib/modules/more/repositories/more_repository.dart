import '../../../utils/helpers/date_helper.dart';
import '../../../utils/services/data_store.dart';
import '../../home/models/timetable_models.dart';
import '../models/more_models.dart';
import 'more_repository_interface.dart';

class LocalMoreRepository implements IMoreRepository {
  LocalMoreRepository(this._db);
  final DataStore _db;

  static const _collections = {'ls_plans', 'ts_tests', 'cr_certs', 'tk_tasks', 'ms_messages', 'tt_periods', 'lm_my', 'lm_balance', 'pm_meetings', 'ed_duties', 'lv_sessions'};

  @override
  Future<MoreSummary> getSummary() async {
    final plans = _db.list('ls_plans');
    return MoreSummary(
      activePlans: plans.where((p) => p['draft'] != true && p['stage'] != 'completed').length,
      draftPlans: plans.where((p) => p['draft'] == true).length,
      upcomingTests: _db.list('ts_tests').where((t) => t['status'] == 'upcoming').length,
      pendingCertificates: _db.list('cr_certs').where((c) => c['status'] == 'pending').length,
      openTasks: _db.list('tk_tasks').where((t) => t['status'] != 'done' && t['done'] != true).length,
      // one row per conversation with an integer `unread` count
      unreadMessages: _db.list('ms_messages').fold<int>(0, (a, m) => a + (m['unread'] is int ? m['unread'] as int : 0)),
      todayClasses: _today().length,
      nextClass: _nextClass(),
      leaveBadge: _leaveBadge(),
      meetingBadge: _meetingBadge(),
      dutyBadge: _dutyBadge(),
      nextLive: _nextLive(),
    );
  }

  /// Today's teaching periods (free/prep periods excluded), in slot order.
  List<Rec> _today() {
    final day = DateTime.now().weekday;
    final rows = _db.list('tt_periods').where((p) => p['day'] == day && p['kind'] != 'prep').toList()
      ..sort((a, b) => '${a['slot']}'.compareTo('${b['slot']}'));
    return rows;
  }

  String _nextClass() {
    final now = DateTime.now();
    final minute = now.hour * 60 + now.minute;
    for (final p in _today()) {
      final s = slotOf('${p['slot']}');
      if (s.startMin > minute) return 'Next at ${t12(hhmmOf(s.startMin))}';
    }
    return 'All done today';
  }

  /// Most-available balance type, e.g. "Casual • 10.5 Days Available".
  String _leaveBadge() {
    final balances = _db.list('lm_balance');
    if (balances.isEmpty) return 'Balance & requests';
    final mine = _db.list('lm_my').where((l) => const {'Approved', 'Completed', 'Pending'}.contains(l['status']));
    final b = balances.first;
    final used = mine.where((l) => l['type'] == b['type']).fold<double>(0, (a, l) => a + ((l['days'] as num?)?.toDouble() ?? 0));
    final left = ((b['total'] as num?)?.toDouble() ?? 0) - used;
    final txt = left % 1 == 0 ? left.toInt().toString() : left.toStringAsFixed(1);
    return '${'${b['type']}'.replaceAll(' Leave', '')} • $txt Days Available';
  }

  String _meetingBadge() {
    final today = todayIso();
    final up = _db.list('pm_meetings').where((m) => m['status'] != 'completed' && '${m['date']}'.compareTo(today) >= 0).toList()
      ..sort((a, b) => '${a['date']}'.compareTo('${b['date']}'));
    if (up.isEmpty) return 'No upcoming meetings';
    final m = up.first;
    return '${fmtDate('${m['date']}')} • ${m['rsvp'] ?? 0} Booked';
  }

  String _dutyBadge() {
    final today = todayIso();
    final up = _db.list('ed_duties').where((d) => d['status'] == 'upcoming' && '${d['date']}'.compareTo(today) >= 0).toList()
      ..sort((a, b) => '${a['date']}${a['start']}'.compareTo('${b['date']}${b['start']}'));
    if (up.isEmpty) return 'No upcoming duties';
    final d = up.first;
    final hall = '${d['hall']}'.replaceFirst('Examination ', '');
    return '$hall • ${fmtDay('${d['date']}')}, ${t12('${d['start']}')}';
  }

  String _nextLive() {
    final live = _db.list('lv_sessions').where((l) => l['status'] == 'live' || l['status'] == 'upcoming').toList();
    if (live.isEmpty) return '';
    live.sort((a, b) => '${a['date']}${a['time']}'.compareTo('${b['date']}${b['time']}'));
    final l = live.first;
    final d = '${l['date']}' == todayIso() ? '' : '${fmtDay('${l['date']}')} ';
    return 'Next: ${l['title']} • $d${t12('${l['time']}')}';
  }

  @override
  Stream<void> watch() => _db.watch(_collections);
}
