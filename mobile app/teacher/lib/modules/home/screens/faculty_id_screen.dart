import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:qr/qr.dart';
import '../../../config/routes/routes.dart';
import '../../../design_system/design_system.dart';
import '../../../di/injection.dart';
import '../../../utils/services/cached_image_service.dart';
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

class _FacultyIdView extends StatefulWidget {
  const _FacultyIdView();
  @override
  State<_FacultyIdView> createState() => _FacultyIdViewState();
}

class _FacultyIdViewState extends State<_FacultyIdView> {
  final _card = GlobalKey();
  bool _exporting = false;

  /// Renders the card exactly as shown into a one-page PDF and opens the system share/save sheet.
  Future<void> _downloadPdf(String name, String empId) async {
    if (_exporting) return;
    setState(() => _exporting = true);
    try {
      final boundary = _card.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) throw StateError('card not ready');
      final image = await boundary.toImage(pixelRatio: 3);
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      if (data == null) throw StateError('card could not be rendered');
      final png = pw.MemoryImage(data.buffer.asUint8List());
      final doc = pw.Document(title: 'Faculty ID • $name');
      doc.addPage(pw.Page(
        pageFormat: PdfPageFormat.a5,
        margin: const pw.EdgeInsets.all(24),
        build: (_) => pw.Center(child: pw.Image(png, fit: pw.BoxFit.contain)),
      ));
      final file = 'faculty-id-${(empId.isEmpty ? name : empId).replaceAll(RegExp(r'[^A-Za-z0-9-]+'), '-')}.pdf';
      await Printing.sharePdf(bytes: await doc.save(), filename: file);
    } catch (e) {
      if (mounted) AppDialogs.showSnackBar(context, message: 'Could not create the PDF: $e');
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final school = context.watch<SchoolBloc>().state;
    final prof = context.watch<ProfileBloc>().state.profile;
    final me = school.teacher;
    final incharge = school.classes.where((c) => c.classTeacher).firstOrNull;
    final empId = me?.empId ?? '';
    final schoolLine = prof.schoolLine.isNotEmpty ? prof.schoolLine : [me?.year ?? '', me?.term ?? ''].where((v) => v.isNotEmpty).join(' • ');
    return DetailScaffold(
      title: 'Digital Faculty ID',
      fallbackRoute: RoutePaths.profile,
      actions: const [TeacherHeaderActions(bell: false)],
      bottom: Row(children: [
        Expanded(
          child: AppButton(_exporting ? 'Preparing…' : 'Download PDF', icon: Icons.download_rounded, kind: BtnKind.outline,
              onPressed: _exporting ? null : () => _downloadPdf(me?.name ?? 'Teacher', empId)),
        ),
        SizedBox(width: 12.w),
        Expanded(
          child: AppButton('Copy ID', icon: Icons.copy_rounded, kind: BtnKind.outline, onPressed: () {
            Clipboard.setData(ClipboardData(text: [me?.name ?? '', me?.empId ?? '', me?.designation ?? '', me?.school ?? ''].where((v) => v.isNotEmpty).join(' • ')));
            AppDialogs.showSnackBar(context, message: 'ID details copied to clipboard');
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
        RepaintBoundary(key: _card, child: Container(
          decoration: BoxDecoration(
            color: C.bg, borderRadius: BorderRadius.circular(R.xxl), border: Border.all(color: C.border),
            boxShadow: [BoxShadow(color: C.ink.withValues(alpha: .08), blurRadius: 24.r, offset: Offset(0, 8.h))],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(children: [
            Container(
              color: C.primaryDark, padding: EdgeInsets.all(14.r),
              child: Row(children: [
                _SchoolLogo(me?.logo ?? ''),
                SizedBox(width: 10.w),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text((me?.school ?? '').toUpperCase(), style: T.h3.copyWith(color: Colors.white, fontSize: 13.sp, height: 1.25), maxLines: 2, overflow: TextOverflow.ellipsis),
                    if (schoolLine.isNotEmpty) ...[
                      SizedBox(height: 2.h),
                      Text(schoolLine, style: T.small.copyWith(color: Colors.white70, fontSize: 10.5.sp), maxLines: 2, overflow: TextOverflow.ellipsis),
                    ],
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
            Avatar(me?.name ?? 'T', size: 132, tone: Tone.brand, image: (me?.photo ?? '').isEmpty ? null : me!.photo),
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
                    Expanded(child: _Cell('Mobile', me?.phone ?? '')), SizedBox(width: 8.w),
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
                    width: 96.r, height: 96.r, padding: EdgeInsets.all(6.r),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(R.md)),
                    child: empId.isEmpty
                        ? Icon(Icons.qr_code_2_rounded, color: C.muted, size: 48.r)
                        : Semantics(label: 'QR code for employee ID $empId', image: true, child: CustomPaint(painter: _QrPainter(facultyQr(empId)))),
                  ),
                  SizedBox(width: 12.w),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text('EMPLOYEE ID', style: T.capsMuted.copyWith(fontSize: 10.sp), maxLines: 1, overflow: TextOverflow.ellipsis)),
                        Pill((me?.status ?? '').isEmpty ? 'Active' : me!.status, tone: (me?.status ?? 'Active') == 'Active' ? Tone.success : Tone.neutral),
                      ]),
                      SizedBox(height: 6.h),
                      Text(empId.isEmpty ? '—' : empId, style: T.h2.copyWith(fontWeight: FontWeight.w800), maxLines: 1, overflow: TextOverflow.ellipsis),
                      SizedBox(height: 4.h),
                      Text(
                        empId.isEmpty ? 'The code appears once the office assigns an employee ID' : 'Scan the code to read the employee ID',
                        style: T.small.copyWith(fontSize: 10.5.sp), maxLines: 2, overflow: TextOverflow.ellipsis,
                      ),
                    ]),
                  ),
                ]),
              ),
            ),
            SizedBox(height: 14.h),
          ]),
        )),
        SizedBox(height: 14.h),
        Text('Issued by ${(me?.school ?? '').isEmpty ? 'the school' : me!.school}', style: T.smallStrong, textAlign: TextAlign.center),
        SizedBox(height: 4.h),
        Text('This digital ID reflects the staff record kept by the school office. For corrections, audits or a lost card, contact the school office.',
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

/// A real QR code carrying the employee ID, so any scanner app reads the number back.
QrImage facultyQr(String empId) => QrImage(QrCode.fromData(data: empId, errorCorrectLevel: QrErrorCorrectLevel.M));

class _QrPainter extends CustomPainter {
  _QrPainter(this.image);
  final QrImage image;

  @override
  void paint(Canvas canvas, Size size) {
    final n = image.moduleCount;
    final c = size.shortestSide / n;
    final p = Paint()..color = C.ink;
    for (var r = 0; r < n; r++) {
      for (var col = 0; col < n; col++) {
        if (image.isDark(r, col)) canvas.drawRect(Rect.fromLTWH(col * c, r * c, c + .2, c + .2), p);
      }
    }
  }

  @override
  bool shouldRepaint(_QrPainter old) => old.image != image;
}

/// The school's logo on the card header, cached on the device after the first download, with the generic emblem
/// when none is set or it cannot be fetched.
class _SchoolLogo extends StatelessWidget {
  const _SchoolLogo(this.url);
  final String url;
  @override
  Widget build(BuildContext context) {
    Widget tile(Widget child, {Color color = Colors.white}) => Container(
      width: 48.r, height: 48.r, padding: EdgeInsets.all(4.r),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(R.md)),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
    if (url.isEmpty) return tile(Icon(Icons.account_balance_rounded, color: Colors.white, size: 24.r), color: Colors.white24);
    final cached = CachedImageService.peek(url);
    if (cached != null) return tile(Image.memory(cached, fit: BoxFit.contain, gaplessPlayback: true));
    return FutureBuilder<Uint8List?>(
      future: CachedImageService.bytes(url),
      builder: (_, snap) => tile(snap.data == null
          ? Icon(Icons.account_balance_rounded, color: snap.hasError || (snap.connectionState == ConnectionState.done) ? C.primaryDark : C.muted, size: 24.r)
          : Image.memory(snap.data!, fit: BoxFit.contain, gaplessPlayback: true)),
    );
  }
}
