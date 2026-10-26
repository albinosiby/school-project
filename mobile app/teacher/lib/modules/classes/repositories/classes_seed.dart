import '../../../utils/services/local_database_service.dart';

DateTime _ago(int days, int h, int m) {
  final n = DateTime.now().subtract(Duration(days: days));
  return DateTime(n.year, n.month, n.day, h, m);
}

Rec _log(String id, String stu, String kind, String badge, String ctx, String note, int merits, String teacher, DateTime at, String status) => {
      'id': id, 'studentId': stu, 'classId': 'cls_10B', 'kind': kind, 'badge': badge, 'context': ctx, 'note': note,
      'merits': merits, 'teacher': teacher, 'at': at.toIso8601String(), 'status': status,
    };

Rec _res(String id, String title, String cat, String sub, num kb, String tag, String tagTone, DateTime at,
        {bool pinned = false, bool isNew = false, int dl = 0, String ext = 'pdf', String stat = ''}) =>
    {
      'id': id, 'classId': 'cls_10B', 'title': '$title.$ext', 'category': cat, 'subtitle': sub, 'sizeKb': kb, 'tag': tag, 'tagTone': tagTone,
      'uploadedAt': at.toIso8601String(), 'pinned': pinned, 'isNew': isNew, 'downloaded': dl, 'shares': 0, 'ext': ext, 'stat': stat,
    };

Rec _doc(String id, String stu, String group, String title, String meta, String tag, {String? score, String? when}) =>
    {'id': id, 'studentId': stu, 'group': group, 'title': title, 'meta': meta, 'tag': tag, 'score': score, 'when': when};

final Seed classesSeed = {
  'cl_pacing': [
    {'id': 'cls_10B', 'done': 14, 'total': 17},
    {'id': 'cls_9A', 'done': 11, 'total': 16},
    {'id': 'cls_8C', 'done': 9, 'total': 14},
    {'id': 'cls_10A', 'done': 13, 'total': 17},
  ],
  'cl_prefs': [
    {'id': 'cl_prefs', 'portalVisible': true},
  ],
  'cl_badges': [
    {'id': 'b1', 'name': 'Academic Leadership', 'kind': 'praise', 'category': 'Leadership & Values', 'icon': 'crown', 'theme': 'Classic Academic Blue', 'merits': 10},
    {'id': 'b2', 'name': 'Peer Tutoring', 'kind': 'praise', 'category': 'Helping Hand', 'icon': 'teamwork', 'theme': 'Emerald Growth', 'merits': 5},
    {'id': 'b3', 'name': 'Creative Problem Solver', 'kind': 'praise', 'category': 'Academic Excellence', 'icon': 'idea', 'theme': 'Sunrise Amber', 'merits': 10},
    {'id': 'b4', 'name': 'Consistent Diligence', 'kind': 'praise', 'category': 'Diligent Effort', 'icon': 'scholar', 'theme': 'Royal Violet', 'merits': 5},
    {'id': 'b5', 'name': 'Punctuality Star', 'kind': 'praise', 'category': 'Diligent Effort', 'icon': 'sparkle', 'theme': 'Classic Academic Blue', 'merits': 5},
    {'id': 'b6', 'name': 'Homework Discrepancy', 'kind': 'flag', 'category': 'Guidance', 'icon': 'idea', 'theme': 'Sunrise Amber', 'merits': 0},
    {'id': 'b7', 'name': 'Late Arrival', 'kind': 'flag', 'category': 'Guidance', 'icon': 'rocket', 'theme': 'Sunrise Amber', 'merits': 0},
    {'id': 'b8', 'name': 'Classroom Disruption', 'kind': 'flag', 'category': 'Guidance', 'icon': 'empathy', 'theme': 'Sunrise Amber', 'merits': 0},
    {'id': 'b9', 'name': 'Medical Consideration', 'kind': 'note', 'category': 'Pastoral', 'icon': 'empathy', 'theme': 'Classic Academic Blue', 'merits': 0},
    {'id': 'b10', 'name': 'Parent Conversation', 'kind': 'note', 'category': 'Pastoral', 'icon': 'teamwork', 'theme': 'Classic Academic Blue', 'merits': 0},
  ],
  'cl_behaviour': [
    _log('bh1', 'stu_101', 'praise', 'Academic Leadership', 'Quadratic Equations Peer Review',
        'Exceptional leadership during the peer quadratic equations review session. Helped 3 struggling students grasp the discriminant rule.', 10, 'Mrs. Anita Sharma', _ago(0, 11, 20), 'Parent notified'),
    _log('bh2', 'stu_102', 'praise', 'Consistent Diligence', 'Advance Calculus Worksheets',
        'Consistently submitted all advance calculus worksheets ahead of time with zero errors. Demonstrated high self-regulation.', 5, 'Mrs. Anita Sharma', _ago(1, 15, 5), 'Parent acknowledged'),
    _log('bh3', 'stu_103', 'flag', 'Homework Discrepancy', 'Medical Consideration',
        'Missed homework submission for Set 4 due to ongoing medical absence. Extension granted until Monday with study buddy assigned.', 0, 'Mrs. Anita Sharma', _ago(2, 9, 40), 'Follow-up scheduled'),
    _log('bh4', 'stu_105', 'praise', 'Lab Safety & Ethics', 'Physics Lab Calibration',
        'Demonstrated exemplary protocol adherence during friction balance calibration in Physics Lab. Guided peer group cleanly.', 8, 'Mr. Rajesh Deshmukh', _ago(3, 13, 30), 'Logged to Dossier'),
    _log('bh5', 'stu_107', 'praise', 'Punctuality Star', 'Morning Roll Call', 'Zero tardy marks recorded for 45 consecutive school days.', 5, 'Mrs. Anita Sharma', _ago(5, 8, 15), 'Parent acknowledged'),
    _log('bh6', 'stu_109', 'flag', 'Late Arrival', 'Morning Assembly', 'Arrived late three times this week. Spoke with the student; parents to be informed.', 0, 'Mrs. Anita Sharma', _ago(6, 8, 50), 'Follow-up scheduled'),
    _log('bh7', 'stu_111', 'note', 'Parent Conversation', 'Term 2 Progress', 'Discussed progress plan with guardian; student keen on olympiad preparation.', 0, 'Mrs. Anita Sharma', _ago(8, 16, 0), 'Logged to Dossier'),
    _log('bh8', 'stu_113', 'praise', 'Peer Tutoring', 'Remedial Support Hour', 'Volunteered to coach classmates for the unit test and prepared a short revision sheet.', 10, 'Mrs. Anita Sharma', _ago(9, 14, 10), 'Parent notified'),
    _log('bh9', 'stu_115', 'praise', 'Creative Problem Solver', 'Coordinate Geometry Challenge', 'Found an alternate, shorter proof for the section formula problem and presented it to the class.', 10, 'Mrs. Anita Sharma', _ago(10, 11, 0), 'Parent notified'),
    _log('bh10', 'stu_117', 'note', 'Medical Consideration', 'Sports Day', 'Advised light activity only for two weeks as per the medical certificate.', 0, 'Mrs. Anita Sharma', _ago(12, 10, 0), 'Logged to Dossier'),
  ],
  'cl_resources': [
    _res('rs1', 'Term 2 Math Formula Handbook', 'Notes & Formulas', 'Comprehensive Guide', 2150, 'Term 2 Mandatory', 'success', _ago(20, 10, 0), pinned: true, dl: 41),
    _res('rs2', 'Standard Algebraic Identities Quick Sheet', 'Notes & Formulas', 'Quick Reference Card', 480, 'Formula Revision', 'brand', _ago(18, 10, 0), pinned: true, dl: 39),
    _res('rs3', 'Quadratic Equations - Problem Set 4', 'Worksheets', 'Uploaded Yesterday', 1434, 'Problem Set', 'brand', _ago(1, 16, 0), isNew: true, dl: 38, stat: '38/42 Downloaded'),
    _res('rs4', 'Friction & Dynamics Practice Sheet', 'Worksheets', '20 Oct 2024', 850, 'Practice', 'brand', _ago(4, 9, 0), ext: 'docx', dl: 42, stat: '42/42 Completed'),
    _res('rs5', 'Polynomial Factorization Drill', 'Worksheets', '12 Oct 2024', 620, 'Drill', 'brand', _ago(12, 9, 0), dl: 40, stat: '40/42 Downloaded'),
    _res('rs6', 'Arithmetic Progressions Worksheet', 'Worksheets', '5 Oct 2024', 540, 'Practice', 'brand', _ago(19, 9, 0), dl: 37, stat: '37/42 Downloaded'),
    _res('rs7', 'Trigonometry Mixed Practice', 'Worksheets', '1 Oct 2024', 710, 'Practice', 'brand', _ago(23, 9, 0), dl: 35, stat: '35/42 Downloaded'),
    _res('rs8', 'Coordinate Geometry Set 2', 'Worksheets', '25 Sep 2024', 660, 'Practice', 'brand', _ago(28, 9, 0), dl: 36, stat: '36/42 Downloaded'),
    _res('rs9', 'Discriminant Cheat Sheet', 'Notes & Formulas', 'Quick Reference Card', 300, 'Revision', 'brand', _ago(15, 9, 0), dl: 33),
    _res('rs10', 'Chapter 4 Lecture Notes', 'Notes & Formulas', 'Class Notes', 1200, 'Lecture Notes', 'brand', _ago(14, 9, 0), dl: 40),
    _res('rs11', 'CBSE Class 10 Math Syllabus Blueprint 2026-27', 'Blueprints', 'Academic Board Release', 950, 'Official Regulation', 'neutral', _ago(60, 9, 0), dl: 42),
    _res('rs12', 'Term 2 Question Paper Blueprint', 'Blueprints', 'Academic Board Release', 520, 'Official Regulation', 'neutral', _ago(45, 9, 0), dl: 42),
  ],
  'cl_documents': [
    _doc('d1', 'stu_101', 'Term 2 Submissions', 'Quadratic Equations Review', 'PDF • 1.8 MB • Yesterday, 4:15 PM', '24/25 (A+)'),
    _doc('d2', 'stu_101', 'Term 2 Submissions', 'Optics & Refraction Lab Report', 'PDF • 3.4 MB • Oct 26', '19/20 (A)'),
    _doc('d3', 'stu_101', 'Lab Reports & Projects', 'Friction Balance Calibration Project', 'PDF • 2.2 MB • Oct 12', '18/20 (A)'),
    _doc('d4', 'stu_101', 'KYC & Board Records', 'Aadhaar Card (UIDAI Verified)', 'UIDAI_Aarav_Sharma_4829.pdf • 1.2 MB', 'GOVT VERIFIED'),
    _doc('d5', 'stu_101', 'KYC & Board Records', 'Birth Certificate & Medical Immunization', 'Birth_Cert_Health_Card_Aarav.pdf • 2.4 MB', 'CBSE BOARD OK'),
    _doc('d6', 'stu_101', 'KYC & Board Records', 'Medical Fitness Certificate', 'Medical_Fitness_Cert_Oct2024.pdf • 850 KB', 'GOVT VERIFIED'),
    _doc('d7', 'stu_102', 'Term 2 Submissions', 'Calculus Worksheet Pack', 'PDF • 1.1 MB • Oct 20', '22/25 (A)'),
    _doc('d8', 'stu_102', 'KYC & Board Records', 'Aadhaar Card (UIDAI Verified)', 'UIDAI_Ananya_2210.pdf • 1.1 MB', 'GOVT VERIFIED'),
  ],
  'cl_doc_requests': [
    {'id': 'dr1', 'studentId': 'stu_102', 'doc': 'Medical Fitness Certificate', 'due': '2026-11-01', 'priority': 'Normal', 'note': 'Required for the sports day roster.', 'notify': true, 'status': 'pending', 'createdAt': '2026-10-20T09:00:00.000'},
  ],
};
