import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../school/bloc/school_bloc.dart';
import '../bloc/profile_bloc.dart';
import '../bloc/profile_events.dart';
import 'widgets/teacher_tab_header.dart';

/// Digital faculty ID card (Figma 1153:2465 "7.2 Digital Faculty ID"), route RoutePaths.facultyId.
class FacultyIdScreen extends StatelessWidget {
  const FacultyIdScreen({super.key});
  @override
  Widget build(BuildContext context) => BlocProvider(
        create: (_) => getIt<ProfileBloc>()..add(const ProfileLoadRequested()),
        child: const _FacultyIdView(),
      );
}

class _FacultyIdView extends StatelessWidget {
  const _FacultyIdView();

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final prof = context.watch<ProfileBloc>().state.profile;
    final me = school.teacher;
    final incharge = school.classes.where((c) => c.classTeacher).firstOrNull;
    final token = prof.token;
    return DetailScaffold(
      title: 'Digital Faculty ID',
      fallbackRoute: RoutePaths.profile,
      actions: const [TeacherHeaderActions()],
      bottom: Row(children: [
        Expanded(
          child: AppButton('Download PDF', icon: Icons.download_rounded, kind: BtnKind.outline,
              onPressed: () => AppDialogs.showSnackBar(context, message: 'Faculty ID saved as PDF (simulated)')),
        ),
        SizedBox(width: 12.w),
        Expanded(
          child: AppButton('Share Link', icon: Icons.share_outlined, kind: BtnKind.outline, onPressed: () {
            Clipboard.setData(ClipboardData(text: 'https://faculty.school.edu/id/$token'));
            AppDialogs.showSnackBar(context, message: 'ID link copied to clipboard');
          }),
        ),
      ]),
      body: ListView(padding: EdgeInsets.fromLTRB(S.page, 14.h, S.page, 24.h), children: [
        Container(
          padding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 10.h),
          decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg), border: Border.all(color: C.border)),
          child: Row(children: [
            Icon(Icons.circle, size: 9.r, color: C.success), SizedBox(width: 8.w),
            Expanded(child: Text('Digital Credential • Verified', style: T.smallStrong, maxLines: 1, overflow: TextOverflow.ellipsis)),
            SizedBox(width: 6.w),
            Pill((me?.empId ?? '').isEmpty ? 'FACULTY' : me!.empId, tone: Tone.brand),
          ]),
        ),
        SizedBox(height: 8.h),
        Row(children: [
          Icon(Icons.contactless_outlined, size: 18.r, color: C.primary), SizedBox(width: 8.w),
          Expanded(child: Text('Tap phone to classroom terminal or gate reader for contactless pass', style: T.small)),
        ]),
        SizedBox(height: 14.h),
        Container(
          decoration: BoxDecoration(
            color: C.bg, borderRadius: BorderRadius.circular(R.xxl), border: Border.all(color: C.border),
            boxShadow: [BoxShadow(color: C.ink.withValues(alpha: .08), blurRadius: 24.r, offset: Offset(0, 8.h))],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(children: [
            Container(
              color: C.primaryDark, padding: EdgeInsets.all(14.r),
              child: Row(children: [
                Container(
                  width: 44.r, height: 44.r,
                  decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(R.md)),
                  child: Icon(Icons.account_balance_rounded, color: Colors.white, size: 24.r),
                ),
                SizedBox(width: 10.w),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text((me?.school ?? '').toUpperCase(), style: T.h3.copyWith(color: Colors.white, fontSize: 13.sp), maxLines: 1)),
                    Text('Affiliated to CBSE, New Delhi • Estd 1982', style: T.small.copyWith(color: Colors.white70, fontSize: 10.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ]),
                ),
                SizedBox(width: 8.w),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
                  decoration: BoxDecoration(color: C.warning, borderRadius: BorderRadius.circular(R.pill)),
                  child: Text('FACULTY PASS', style: T.smallStrong.copyWith(fontSize: 10.5.sp)),
                ),
              ]),
            ),
            SizedBox(height: 18.h),
            Avatar(me?.name ?? 'T', size: 92, tone: Tone.brand),
            SizedBox(height: 10.h),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 14.w),
              child: Column(children: [
                Text(me?.name ?? '', style: T.title, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis),
                Text('${me?.designation ?? ''} — ${me?.subjects ?? ''}', style: T.bodyStrong.copyWith(color: C.primary), textAlign: TextAlign.center),
              ]),
            ),
            SizedBox(height: 6.h),
            Wrap(alignment: WrapAlignment.center, crossAxisAlignment: WrapCrossAlignment.center, spacing: 8.w, runSpacing: 4.h, children: [
              if (incharge != null) Text('Class Teacher, ${incharge.grade}–${incharge.section}', style: T.small),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(6.r)),
                child: Text(me?.empId ?? '', style: T.smallStrong),
              ),
            ]),
            SizedBox(height: 14.h),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 14.w),
              child: Container(
                padding: EdgeInsets.all(10.r),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg)),
                child: Column(children: [
                  Row(children: [
                    Expanded(child: _Cell('Department', prof.department)), SizedBox(width: 8.w),
                    Expanded(child: _Cell('Blood Group', prof.bloodGroup, color: C.danger)),
                  ]),
                  SizedBox(height: 8.h),
                  Row(children: [
                    Expanded(child: _Cell('Emergency Phone', prof.emergency)), SizedBox(width: 8.w),
                    Expanded(child: _Cell('Valid Through', prof.validThrough, color: C.primary)),
                  ]),
                ]),
              ),
            ),
            SizedBox(height: 12.h),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 14.w),
              child: Container(
                padding: EdgeInsets.all(12.r),
                decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.lg)),
                child: Row(children: [
                  Container(
                    width: 84.r, height: 84.r, padding: EdgeInsets.all(6.r),
                    decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.md)),
                    child: Semantics(label: 'QR code', image: true, child: CustomPaint(painter: _CodePainter(token, qr: true))),
                  ),
                  SizedBox(width: 12.w),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text('AUTHENTIC TOKEN', style: T.capsMuted.copyWith(fontSize: 10.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
                        const Pill('ISO-27001', tone: Tone.brand),
                      ]),
                      SizedBox(height: 8.h),
                      SizedBox(height: 34.h, width: double.infinity, child: Semantics(label: 'Barcode', image: true, child: CustomPaint(painter: _CodePainter(token)))),
                      SizedBox(height: 4.h),
                      Text(token, style: T.small.copyWith(fontSize: 10.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ]),
                  ),
                ]),
              ),
            ),
            SizedBox(height: 12.h),
            Container(
              margin: EdgeInsets.symmetric(horizontal: 14.w), padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 8.h),
              decoration: BoxDecoration(gradient: const LinearGradient(colors: [C.warningSoft, C.panel, C.successSoft]), borderRadius: BorderRadius.circular(R.md)),
              child: Row(children: [
                Icon(Icons.shield_outlined, size: 14.r), SizedBox(width: 6.w),
                Expanded(child: Text('GOVT. ACCREDITED • SECURE ID', style: T.smallStrong.copyWith(fontSize: 10.5.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
                Text(prof.cardNo, style: T.smallStrong.copyWith(fontSize: 10.5.sp, color: C.successDark)),
              ]),
            ),
            SizedBox(height: 14.h),
          ]),
        ),
        SizedBox(height: 14.h),
        Text('Official Institutional Clearance', style: T.smallStrong, textAlign: TextAlign.center),
        SizedBox(height: 4.h),
        Text('This digital credential is officially authorized by school administration. For security inquiries, audits, or lost card reporting, contact Admin Desk Ext #102.',
            style: T.small.copyWith(fontSize: 11.sp), textAlign: TextAlign.center),
      ]),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell(this.l, this.v, {this.color});
  final String l, v;
  final Color? color;
  @override
  Widget build(BuildContext context) => Container(
        padding: EdgeInsets.all(10.r), alignment: Alignment.centerLeft,
        decoration: BoxDecoration(color: C.bg, borderRadius: BorderRadius.circular(R.md)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l, style: T.small.copyWith(fontSize: 11.sp), maxLines: 1, overflow: TextOverflow.ellipsis),
          SizedBox(height: 2.h),
          Text(v, style: T.bodyStrong.copyWith(color: color ?? C.ink, fontSize: 13.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
        ]),
      );
}

/// Deterministic decorative QR / barcode derived from the token string.
class _CodePainter extends CustomPainter {
  _CodePainter(this.seed, {this.qr = false});
  final String seed;
  final bool qr;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = C.ink;
    var h = seed.codeUnits.fold<int>(7, (a, b) => (a * 31 + b) & 0x7fffffff);
    int next() {
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      return h;
    }

    if (qr) {
      const n = 21;
      final c = size.width / n;
      bool finder(int x, int y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
      for (var y = 0; y < n; y++) {
        for (var x = 0; x < n; x++) {
          bool on;
          if (finder(x, y)) {
            final fx = x >= n - 7 ? x - (n - 7) : x, fy = y >= n - 7 ? y - (n - 7) : y;
            on = fx == 0 || fx == 6 || fy == 0 || fy == 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
          } else {
            on = next() % 2 == 0;
          }
          if (on) canvas.drawRect(Rect.fromLTWH(x * c, y * c, c + .3, c + .3), p);
        }
      }
    } else {
      final unit = size.height / 34; // scales bar widths with the box
      var x = 0.0;
      while (x < size.width) {
        final w = (1.0 + next() % 3) * unit;
        if (next() % 2 == 0) canvas.drawRect(Rect.fromLTWH(x, 0, w, size.height), p);
        x += w + unit;
      }
    }
  }

  @override
  bool shouldRepaint(_CodePainter old) => old.seed != seed || old.qr != qr;
}
