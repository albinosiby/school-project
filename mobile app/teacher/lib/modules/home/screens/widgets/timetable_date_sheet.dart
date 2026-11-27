import 'package:flutter/material.dart';
import '../../../../design_system/design_system.dart';
import '../../models/timetable_models.dart';

/// What the timetable calendar returned: one day ([to] null) or a range of days.
typedef TimetablePick = ({DateTime from, DateTime? to});

/// Longest range the timetable lists at once.
const kMaxRangeDays = 31;

/// Full-month calendar for the timetable. A red dot marks days with attendance still to mark ([missing]).
/// Tap one date to open that day; tap a second date to pick the range between them.
/// [allowRange] false keeps it to one day; [last] disables later days (e.g. no attendance for tomorrow);
/// [missingLabel] titles the strip of red-dot days of the shown month (tap one to pick it).
Future<TimetablePick?> showTimetableDateSheet(
  BuildContext context, {
  required DateTime from,
  DateTime? to,
  required DateTime today,
  bool Function(DateTime day)? missing,
  bool allowRange = true,
  DateTime? last,
  String title = 'Calendar',
  String missingLabel = 'Attendance not marked',
}) => showAppSheet<TimetablePick>(
  context,
  title: title,
  subtitle: allowRange ? 'Tap a day, or two days for a range' : 'Red dot: attendance still to mark',
  builder: (_) => _DateSheet(
    from: from,
    to: to,
    today: today,
    missing: missing ?? (_) => false,
    allowRange: allowRange,
    last: last,
    missingLabel: missingLabel,
  ),
);

class _DateSheet extends StatefulWidget {
  const _DateSheet({
    required this.from,
    required this.to,
    required this.today,
    required this.missing,
    this.allowRange = true,
    this.last,
    this.missingLabel = 'Attendance not marked',
  });
  final DateTime from, today;
  final DateTime? to, last;
  final bool Function(DateTime day) missing;
  final bool allowRange;
  final String missingLabel;
  @override
  State<_DateSheet> createState() => _DateSheetState();
}

class _DateSheetState extends State<_DateSheet> {
  static final _first = DateTime(2024);
  DateTime get _last => widget.last == null ? DateTime(2030, 12, 31) : _day(widget.last!);
  late DateTime _start = _day(widget.from);
  late DateTime? _end = widget.to == null ? null : _day(widget.to!);
  late DateTime _month = DateTime(_start.year, _start.month);

  static DateTime _day(DateTime d) => DateTime(d.year, d.month, d.day);
  static bool _same(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;
  static String _fmt(DateTime d) => '${kDayShort[d.weekday - 1]}, ${dayMonth(d)}';

  bool get _canBack => DateTime(_month.year, _month.month).isAfter(_first);
  bool get _canNext => DateTime(_month.year, _month.month + 1).isBefore(_last);
  bool _school(DateTime d) => schoolWorkingDays.contains(d.weekday);

  /// First tap picks a day; a second, later tap closes the range; any tap after that (or an earlier date) starts over.
  void _tap(DateTime d) {
    setState(() {
      if (!widget.allowRange || _end != null || !d.isAfter(_start)) {
        _start = d;
        _end = null;
      } else if (d.difference(_start).inDays >= kMaxRangeDays) {
        AppDialogs.showSnackBar(context, message: 'Pick up to $kMaxRangeDays days');
      } else {
        _end = d;
      }
    });
  }

  void _jumpToday() => setState(() {
    _start = _day(widget.today);
    _end = null;
    _month = DateTime(_start.year, _start.month);
  });

  /// School days of the shown month (up to today / [widget.last]) with a red dot, oldest first.
  List<DateTime> get _missedInMonth {
    final days = DateUtils.getDaysInMonth(_month.year, _month.month);
    final end = _last.isBefore(widget.today) ? _last : _day(widget.today);
    return [
      for (var n = 1; n <= days; n++)
        if (() {
          final d = DateTime(_month.year, _month.month, n);
          return !d.isAfter(end) && _school(d) && widget.missing(d);
        }())
          DateTime(_month.year, _month.month, n),
    ];
  }

  int get _schoolDays {
    var n = 0;
    for (var d = _start; !d.isAfter(_end ?? _start); d = DateTime(d.year, d.month, d.day + 1)) {
      if (_school(d)) n++;
    }
    return n;
  }

  @override
  Widget build(BuildContext context) {
    final lead = DateTime(_month.year, _month.month).weekday - 1; // Monday-first grid
    final days = DateUtils.getDaysInMonth(_month.year, _month.month);
    final rows = ((lead + days) / 7).ceil();
    final range = _end != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            IconButton(
              tooltip: 'Previous month',
              onPressed: _canBack ? () => setState(() => _month = DateTime(_month.year, _month.month - 1)) : null,
              icon: Icon(Icons.chevron_left_rounded, size: 24.r),
            ),
            Expanded(
              child: Text('${kMonthsLong[_month.month - 1]} ${_month.year}', textAlign: TextAlign.center, style: T.h3),
            ),
            IconButton(
              tooltip: 'Next month',
              onPressed: _canNext ? () => setState(() => _month = DateTime(_month.year, _month.month + 1)) : null,
              icon: Icon(Icons.chevron_right_rounded, size: 24.r),
            ),
          ],
        ),
        SizedBox(height: 4.h),
        Row(
          children: [
            for (var i = 0; i < 7; i++)
              Expanded(
                child: Center(
                  child: Text(
                    kDayShort[i].substring(0, 1),
                    style: T.small.copyWith(fontSize: 11.sp, fontWeight: FontWeight.w700, color: schoolWorkingDays.contains(i + 1) ? C.slate : C.muted),
                  ),
                ),
              ),
          ],
        ),
        SizedBox(height: 6.h),
        for (var r = 0; r < rows; r++)
          Row(
            children: [for (var c = 0; c < 7; c++) Expanded(child: _cell(r * 7 + c - lead + 1, days))],
          ),
        if (_missedInMonth.isNotEmpty) ...[
          SizedBox(height: 10.h),
          Text('${_missedInMonth.length} ${_missedInMonth.length == 1 ? 'day' : 'days'} to mark in ${kMonthsLong[_month.month - 1]}', style: T.smallStrong.copyWith(color: C.danger)),
          SizedBox(height: 6.h),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final d in _missedInMonth)
                  Padding(
                    padding: EdgeInsets.only(right: 6.w),
                    child: ActionChip(
                      key: ValueKey('missed-${d.year}-${d.month}-${d.day}'),
                      avatar: Icon(Icons.error_outline_rounded, size: 15.r, color: C.danger),
                      label: Text(_fmt(d)),
                      backgroundColor: _same(d, _start) && _end == null ? C.dangerSoft : C.bg,
                      side: BorderSide(color: C.danger.withValues(alpha: .35)),
                      onPressed: () => setState(() {
                        _start = d;
                        _end = null;
                      }),
                    ),
                  ),
              ],
            ),
          ),
        ],
        SizedBox(height: 8.h),
        Row(
          children: [
            Container(width: 7.r, height: 7.r, decoration: const BoxDecoration(color: C.danger, shape: BoxShape.circle)),
            SizedBox(width: 6.w),
            Expanded(child: Text(widget.missingLabel, style: T.small.copyWith(fontSize: 11.5.sp))),
            TextButton(onPressed: _jumpToday, child: Text('Today', style: T.smallStrong.copyWith(color: C.primary))),
          ],
        ),
        SizedBox(height: 6.h),
        Container(
          padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 10.h),
          decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md)),
          child: Row(
            children: [
              Icon(range ? Icons.date_range_rounded : Icons.today_rounded, size: 18.r, color: C.primary),
              SizedBox(width: 8.w),
              Expanded(
                child: Text(
                  range ? '${_fmt(_start)} – ${_fmt(_end!)}' : _fmt(_start),
                  style: T.bodyStrong.copyWith(fontSize: 13.sp),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (range) Text('$_schoolDays school ${_schoolDays == 1 ? 'day' : 'days'}', style: T.small.copyWith(fontSize: 11.5.sp)),
            ],
          ),
        ),
        SizedBox(height: 12.h),
        AppButton(
          range ? 'Show these days' : 'Show this day',
          key: const ValueKey('date-sheet-apply'),
          icon: range ? Icons.date_range_rounded : Icons.view_agenda_outlined,
          onPressed: !range && !_school(_start)
              ? null
              : () => Navigator.pop(context, (from: _start, to: _end)),
        ),
      ],
    );
  }

  Widget _cell(int n, int days) {
    if (n < 1 || n > days) return SizedBox(height: 42.h);
    final d = DateTime(_month.year, _month.month, n);
    final school = _school(d);
    final today = _same(d, widget.today);
    final end = _end;
    final isStart = _same(d, _start), isEnd = end != null && _same(d, end);
    final inside = end != null && d.isAfter(_start) && d.isBefore(end);
    final edge = isStart || isEnd;
    final out = d.isBefore(_first) || d.isAfter(_last);
    final dot = school && !d.isAfter(widget.today) && widget.missing(d);
    final fg = edge ? Colors.white : (inside ? C.primary : (school ? C.ink : C.muted));
    return Semantics(
      button: true,
      selected: edge || inside,
      label: '${_fmt(d)}${today ? ', today' : ''}${dot ? ', attendance not marked' : ''}',
      child: InkWell(
        key: ValueKey('cal-${d.year}-${d.month}-${d.day}'),
        borderRadius: BorderRadius.circular(R.pill),
        onTap: out ? null : () => _tap(d),
        child: SizedBox(
          height: 42.h,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // the range band runs behind the day circles, from the start circle's centre to the end circle's
              if (inside || (end != null && edge))
                Positioned.fill(
                  top: 4.h,
                  bottom: 4.h,
                  child: FractionallySizedBox(
                    alignment: isStart ? Alignment.centerRight : Alignment.centerLeft,
                    widthFactor: edge ? .5 : 1,
                    child: Container(color: C.primarySoft),
                  ),
                ),
              Container(
                width: 34.r,
                height: 34.r,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: edge ? C.primary : Colors.transparent,
                  shape: BoxShape.circle,
                  border: today && !edge ? Border.all(color: C.primary.withValues(alpha: .6), width: 1.5) : null,
                ),
                child: Text(
                  '$n',
                  style: T.body.copyWith(fontSize: 13.5.sp, fontWeight: edge || today ? FontWeight.w700 : FontWeight.w500, color: fg),
                ),
              ),
              if (dot)
                Positioned(
                  bottom: 2.h,
                  child: Container(
                    key: ValueKey('cal-dot-${d.year}-${d.month}-${d.day}'),
                    width: 5.r,
                    height: 5.r,
                    decoration: const BoxDecoration(color: C.danger, shape: BoxShape.circle),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

const kMonthsLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
