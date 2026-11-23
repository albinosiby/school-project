import 'package:equatable/equatable.dart';

class Period extends Equatable {
  const Period({
    required this.weekday,
    required this.startMinute,
    required this.endMinute,
    required this.subject,
    required this.teacher,
    required this.room,
    this.isBreak = false,
    this.number,
  });

  /// DateTime.monday .. DateTime.sunday
  final int weekday;
  final int startMinute, endMinute;
  final String subject, teacher, room;
  final bool isBreak;
  final int? number;

  bool isNow(DateTime now) {
    final m = now.hour * 60 + now.minute;
    return now.weekday == weekday && m >= startMinute && m < endMinute;
  }

  bool isOver(DateTime now) => now.weekday == weekday && now.hour * 60 + now.minute >= endMinute;

  @override
  List<Object?> get props => [weekday, startMinute, endMinute, subject, teacher, room, isBreak, number];
}

class TimetableWeek extends Equatable {
  const TimetableWeek(this.periods, {this.utcOffsetMinutes});
  final int? utcOffsetMinutes;
  DateTime get now => utcOffsetMinutes == null ? DateTime.now() : DateTime.now().toUtc().add(Duration(minutes: utcOffsetMinutes!));
  final List<Period> periods;

  List<Period> forDay(int weekday) =>
      periods.where((p) => p.weekday == weekday).toList()..sort((a, b) => a.startMinute.compareTo(b.startMinute));
  List<int> get days => (periods.map((p) => p.weekday).toSet().toList()..sort());

  @override
  List<Object?> get props => [periods, utcOffsetMinutes];
}
