import 'dart:math';
import 'package:intl/intl.dart';
import '../../school/repositories/school_seed.dart';
import '../../../utils/services/local_database_service.dart';

String _k(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

DateTime _today() {
  final n = DateTime.now();
  return DateTime(n.year, n.month, n.day);
}

/// Attendance records for the last ~9 weeks. `marks` only lists deviations
/// from "present" (A absent, L late, E excused) – missing student = present.
List<Rec> _records() {
  final studs = schoolSeed['students']!;
  final t0 = _today();
  final rnd = Random(42);
  const baseAbs = {'cls_10B': .06, 'cls_9A': .08, 'cls_8C': .09, 'cls_10A': .06};
  final out = <Rec>[];
  var wd = 0;
  for (var back = 0; back <= 63; back++) {
    final d = t0.subtract(Duration(days: back));
    if (d.weekday > 5) continue;
    final isToday = back == 0;
    if (!isToday) wd++;
    for (final cid in ['cls_10B', 'cls_9A', 'cls_8C', 'cls_10A']) {
      if (isToday && cid != 'cls_9A') continue;
      final ss = studs.where((s) => s['classId'] == cid).toList();
      final marks = <String, String>{};
      for (final s in ss) {
        final id = s['id'] as String;
        var pa = baseAbs[cid]!;
        if (id == 'stu_103') pa = .30;
        if (id == 'stu_131') pa = .24;
        if (id == 'stu_119') pa = d.weekday == 1 ? .55 : .05;
        final r = rnd.nextDouble();
        String? m;
        if (id == 'stu_103' && !isToday && wd <= 3) {
          m = 'A';
        } else if (r < pa) {
          m = 'A';
        } else if (r < pa + .02) {
          m = 'L';
        } else if (r < pa + .028) {
          m = 'E';
        }
        if (m != null) marks[id] = m;
      }
      out.add({
        'id': 'ar_${cid}_${_k(d)}_${isToday ? 1 : 3}', 'classId': cid, 'date': _k(d), 'period': isToday ? 1 : 3,
        'total': ss.length, 'marks': marks, 'submitted': true,
        'updatedAt': d.add(const Duration(hours: 9)).toIso8601String(),
      });
    }
  }
  return out;
}

List<Rec> _staff() {
  final t0 = _today();
  final rows = <Rec>[];
  var i = 0;
  for (var back = 0; back <= 70; back++) {
    final d = t0.subtract(Duration(days: back));
    if (d.weekday > 5) continue;
    i++;
    if (back == 0) {
      rows.add({'id': 'sl_${_k(d)}', 'date': _k(d), 'in': '08:15', 'out': null, 'status': 'Present', 'note': 'Campus Main Gate (Verified)'});
      continue;
    }
    if (i == 3) {
      rows.add({'id': 'sl_${_k(d)}', 'date': _k(d), 'in': null, 'out': '16:15', 'status': 'Irregular', 'note': 'In-punch missed (Gate 2 Terminal)'});
    } else if (i == 6) {
      rows.add({'id': 'sl_${_k(d)}', 'date': _k(d), 'in': '08:47', 'out': '16:20', 'status': 'Late', 'note': 'Late by 17 mins - traffic delay acknowledged by Admin'});
    } else if (i == 9) {
      rows.add({'id': 'sl_${_k(d)}', 'date': _k(d), 'in': null, 'out': null, 'status': 'Leave', 'note': 'Authorized by Principal Sharma'});
    } else if (i == 12) {
      rows.add({'id': 'sl_${_k(d)}', 'date': _k(d), 'in': '08:12', 'out': null, 'status': 'Irregular', 'note': 'Out-punch missed'});
    } else {
      rows.add({'id': 'sl_${_k(d)}', 'date': _k(d), 'in': '08:0${i % 6}', 'out': '16:3${i % 5}', 'status': 'Present', 'note': 'Biometric Gate #1 (Verified)'});
    }
  }
  return rows;
}

List<Rec> _marks() {
  final studs = schoolSeed['students']!;
  final out = <Rec>[];
  void gen(String ex, String cid, int max, {required int pending, bool submitted = false}) {
    final ss = studs.where((s) => s['classId'] == cid).toList();
    for (var i = 0; i < ss.length - pending; i++) {
      final v = ((max * (.42 + ((i * 37) % 55) / 100)).round()).clamp(0, max);
      final absent = i == 7 && !submitted;
      out.add({
        'id': '${ex}_${ss[i]['id']}', 'examId': ex, 'studentId': ss[i]['id'],
        'status': absent ? 'Absent' : 'Present', 'marks': absent ? null : v,
        'tag': ['Consistent', 'Outstanding', 'Needs Revision', 'Consistent'][i % 4], 'note': '',
      });
    }
  }

  gen('ex_1', 'cls_10A', 50, pending: 6);
  gen('ex_2', 'cls_10B', 50, pending: 12);
  gen('ex_3', 'cls_9A', 25, pending: 0, submitted: true);
  return out;
}

const _sections = [
  {'k': 'A', 'name': 'Objective & MCQs', 'desc': '15 Questions • 1 point each', 'max': 15},
  {'k': 'B', 'name': 'Short Answer Theory', 'desc': '5 Questions • 3 points each', 'max': 15},
  {'k': 'C', 'name': 'Long Form Problems', 'desc': '4 Problems • 5 points each', 'max': 20},
];

List<Rec> _circulars() {
  final t0 = _today();
  String d(int back) => _k(t0.subtract(Duration(days: back)));
  final rows = <(String, String, String, String, String, bool, bool)>[
    ('Academic', 'Parent-Teacher Meeting (PTM) Schedule for Grades 9–12', 'PTM on Saturday, Nov 02 (09:00 AM – 01:30 PM). Class teachers must keep progress dossiers ready.', 'Dr. A. Sharma', 'Academic Office', false, false),
    ('Admin', 'Revised Winter Timings & Morning Assembly Protocol', 'Reporting time shifts to 08:15 AM starting Nov 01 due to winter schedule. Assembly will be held in classrooms.', 'Principal Sharma', 'Administration', true, true),
    ('Events', 'Annual Inter-School Athletic Meet 2024 — Duty Allocations', 'House in-charges must verify student fitness certificates before Oct 30 and submit entry sheets.', 'Mr. R. Deshmukh', 'Sports Department', true, false),
    ('Academic', 'Term 2 Examination Blueprint Guidelines', 'Faculty members are required to submit two confidential sets of Question Papers and Marking Scheme Blueprints for Term 2 Examinations aligned with state board standards.', 'Dr. A. Sharma', 'Office of Controller of Examinations', false, false),
    ('Admin', 'Staff Biometric Re-enrolment Drive', 'All staff must re-enrol biometrics at the admin block between 10 AM and 2 PM this week.', 'Admin Office', 'Administration', true, false),
    ('Academic', 'Internal Assessment Marks Submission Deadline', 'Enter and submit internal assessment marks in the portal before the deadline. Late edits need written approval.', 'Dr. A. Sharma', 'Academic Office', false, false),
    ('Academic', 'Lab Safety Audit for Science Block', 'Subject teachers to complete the quarterly lab safety checklist and report any defects.', 'Mrs. P. Nair', 'Science Department', true, true),
    ('Academic', 'Revised Syllabus Coverage Plan (Maths & Science)', 'Updated pacing guide for Term 2 is attached. Align weekly lesson plans accordingly.', 'Dr. A. Sharma', 'Academic Office', true, false),
    ('Admin', 'Holiday Declaration: Diwali Break', 'School will remain closed from Oct 31 to Nov 04. Classes resume on Nov 05.', 'Principal Sharma', 'Administration', true, true),
    ('Admin', 'Revised Leave Application Procedure', 'Leave must be applied at least 3 days in advance with a class handover plan for each period.', 'HR Desk', 'Administration', true, false),
    ('Events', 'Science Exhibition: Project Guidelines', 'Classes 8–10 will present working models. Mentors to register teams by Nov 10.', 'Mrs. P. Nair', 'Science Department', true, false),
    ('General', 'Staff Room Etiquette & Cleanliness Drive', 'A reminder to follow staff room guidelines and the green-campus initiative.', 'Admin Office', 'Administration', true, false),
    ('General', 'Library Hours Extended for Term 2', 'The library remains open until 5:00 PM on weekdays during examinations.', 'Librarian', 'Library', true, false),
    ('Academic', 'Report Card Comments: Format Update', 'Comments should be capped at 300 characters and must include one improvement action.', 'Dr. A. Sharma', 'Academic Office', true, false),
  ];
  return [
    for (var i = 0; i < rows.length; i++)
      {
        'id': 'cir_${i + 1}', 'ref': 'CIR-2026-${(90 - i).toString().padLeft(3, '0')}', 'cat': rows[i].$1, 'title': rows[i].$2, 'summary': rows[i].$3,
        'author': rows[i].$4, 'office': rows[i].$5, 'date': d(i * 3 + 1), 'read': rows[i].$6, 'ack': rows[i].$7, 'pinned': i == 0,
        'audience': 'Secondary & Senior Secondary Faculty',
        'points': ['Review the full directive and plan accordingly.', 'Submission is via the faculty portal only.', 'Contact the issuing office for clarifications.'],
        'attachment': i % 3 == 0 ? {'name': 'Circular_${90 - i}_AY2026-27.pdf', 'size': '${(1 + i % 3 * .7).toStringAsFixed(1)} MB'} : null,
      }
  ];
}

final Seed attendanceSeed = {
  'att_records': _records(),
  'att_notices': [],
  'att_sched': [
    {'id': 'sc_1', 'classId': 'cls_9A', 'period': 1},
    {'id': 'sc_2', 'classId': 'cls_10B', 'period': 3},
    {'id': 'sc_3', 'classId': 'cls_10A', 'period': 5},
  ],
  'att_staff': _staff(),
  'att_regs': [],
  'att_quota': [
    {'id': 'CL', 'name': 'Casual (CL)', 'short': 'Casual Leave', 'total': 12, 'used': 6},
    {'id': 'ML', 'name': 'Medical (ML)', 'short': 'Medical Leave', 'total': 10, 'used': 2},
    {'id': 'DL', 'name': 'Duty Leave (DL)', 'short': 'Duty Leave', 'total': 6, 'used': 2},
  ],
  'att_leaves': [
    {
      'id': 'lv_1', 'type': 'Casual Leave', 'start': _k(_today().subtract(const Duration(days: 12))), 'end': _k(_today().subtract(const Duration(days: 12))),
      'days': 1, 'coverage': 'Full Day', 'reason': 'Family function', 'status': 'Approved', 'by': 'Principal', 'handovers': [],
      'createdAt': _today().subtract(const Duration(days: 15)).toIso8601String(),
    },
  ],
  'att_periods': [
    {'id': 'hp_1', 'time': '10:15 AM – 11:00 AM', 'label': 'Period 3', 'cls': 'Grade 10–A • Mathematics', 'room': 'Room 302'},
    {'id': 'hp_2', 'time': '01:15 PM – 02:00 PM', 'label': 'Period 5', 'cls': 'Grade 9–B • Advanced Algebra', 'room': 'Room 204'},
  ],
  'att_faculty': [
    {'id': 'fac_1', 'name': 'Mrs. Sunita Kapoor', 'role': 'Senior Math Faculty • 10 yrs exp', 'free': 'Free Period 3'},
    {'id': 'fac_2', 'name': 'Mr. Rajesh Deshmukh', 'role': 'Science & Applied Math', 'free': 'Free Period 3'},
    {'id': 'fac_3', 'name': 'Ms. Anjali Mehta', 'role': 'Junior Math Teacher', 'free': 'Free Period 3'},
  ],
  'att_slips': [
    {
      'id': 'ls_1', 'studentId': 'stu_102', 'type': 'Medical Leave', 'from': _k(_today()), 'to': _k(_today().add(const Duration(days: 2))),
      'reason': 'Fever', 'parent': 'Sunita Patel (Mother)', 'note': 'Ananya has been diagnosed with acute viral fever. Doctor advised 3 days bed rest. Medical certificate and prescription attached.',
      'files': [
        {'name': 'Medical Fitness Certificate', 'meta': 'Apollo Clinic • 1.4 MB PDF'},
        {'name': 'Doctor Prescription', 'meta': 'Dr. K. Sharma • 840 KB JPG'},
      ],
      'status': 'Pending',
    },
    {
      'id': 'ls_2', 'studentId': 'stu_150', 'type': 'Family', 'from': _k(_today().add(const Duration(days: 1))), 'to': _k(_today().add(const Duration(days: 1))),
      'reason': 'Family', 'parent': 'Parent / Guardian', 'note': 'We need to travel out of town for a family event. Kindly grant one day leave.', 'files': [], 'status': 'Pending',
    },
  ],
  'att_medical': [
    {
      'id': 'md_1', 'studentId': 'stu_131', 'title': 'Viral Fever & Convalescence Slip', 'clinic': 'Apex Health Care • Dr. R. K. Mehta (Reg #4192)',
      'from': _k(_today().subtract(const Duration(days: 4))), 'to': _k(_today().subtract(const Duration(days: 2))), 'days': 3,
      'file': 'MEHTA_MED_2110.pdf (1.4 MB)', 'uploader': 'Mrs. Gurpreet Kaur (Mother)', 'uploadedAt': 'Yesterday, 09:15 AM', 'status': 'Pending', 'by': '',
    },
    {
      'id': 'md_2', 'studentId': 'stu_131', 'title': 'Severe Allergic Rhinitis Certificate', 'clinic': 'City Pediatric Center • Dr. S. Nambiar',
      'from': _k(_today().subtract(const Duration(days: 40))), 'to': _k(_today().subtract(const Duration(days: 40))), 'days': 1,
      'file': 'NAMBIAR_CERT.pdf (0.9 MB)', 'uploader': 'Mrs. Gurpreet Kaur (Mother)', 'uploadedAt': 'Sep 12, 08:40 AM', 'status': 'Approved', 'by': 'Principal Sharma',
    },
  ],
  'att_exams': [
    {'id': 'ex_1', 'classId': 'cls_10A', 'name': 'Term 2 Mid-Term Exam', 'subject': 'Mathematics', 'max': 50, 'status': 'Draft', 'sections': _sections},
    {'id': 'ex_2', 'classId': 'cls_10B', 'name': 'Term 2 Mid-Term Exam', 'subject': 'Advanced Mathematics', 'max': 50, 'status': 'Draft', 'sections': _sections},
    {'id': 'ex_3', 'classId': 'cls_9A', 'name': 'Unit Test 2', 'subject': 'Science', 'max': 25, 'status': 'Submitted', 'sections': []},
    {'id': 'ex_4', 'classId': 'cls_8C', 'name': 'Unit Test 2', 'subject': 'Physics', 'max': 20, 'status': 'Draft', 'sections': []},
  ],
  'att_marks': _marks(),
  'att_circulars': _circulars(),
};
