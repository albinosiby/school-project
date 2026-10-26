import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:google_fonts/google_fonts.dart';

/// Colors sampled from the Figma "Teacher App" frames.
class C {
  C._();
  static const primary = Color(0xFF2F4FD8);
  static const primaryDark = Color(0xFF1B42CD);
  static const primarySoft = Color(0xFFEFF6FF);
  static const panel = Color(0xFFF5FAFF);
  static const panelBorder = Color(0xFFD6E4FB);
  static const border = Color(0xFFE2E8F0);
  static const ink = Color(0xFF0F172A);
  static const text = Color(0xFF171717);
  static const slate = Color(0xFF64748B);
  static const muted = Color(0xFF94A3B8);
  static const bg = Color(0xFFFFFFFF);
  static const surface = Color(0xFFF8FAFC);
  static const success = Color(0xFF10B981);
  static const successDark = Color(0xFF047857);
  static const successSoft = Color(0xFFD1FAE5);
  static const warning = Color(0xFFF59E0B);
  static const warningDark = Color(0xFFB45309);
  static const warningSoft = Color(0xFFFEF3C7);
  static const danger = Color(0xFFBA1A1A);
  static const dangerSoft = Color(0xFFFFE4E1);
  static const purple = Color(0xFF7C3AED);
  static const purpleSoft = Color(0xFFEDE9FE);
}

/// Corner radii. Getters because they depend on ScreenUtil (call after ScreenUtilInit).
class R {
  R._();
  static double get sm => 8.r;
  static double get md => 12.r;
  static double get lg => 16.r;
  static double get xl => 20.r;
  static double get xxl => 24.r;
  static double get pill => 999.r;
}

/// Layout spacing.
class S {
  S._();
  static double get page => 16.w;
  static double get gap => 12.w;
}

TextStyle _f(double size, FontWeight w, Color c, {double? h, double? ls}) =>
    GoogleFonts.inter(fontSize: size.sp, fontWeight: w, color: c, height: h, letterSpacing: ls);

/// Text styles (sizes scale with ScreenUtil `.sp`).
class T {
  T._();
  static TextStyle get title => _f(22, FontWeight.w800, C.ink, h: 1.2);
  static TextStyle get h1 => _f(20, FontWeight.w800, C.ink, h: 1.25);
  static TextStyle get h2 => _f(17, FontWeight.w700, C.ink, h: 1.3);
  static TextStyle get h3 => _f(15, FontWeight.w700, C.ink, h: 1.3);
  static TextStyle get body => _f(14, FontWeight.w400, C.slate, h: 1.4);
  static TextStyle get bodyStrong => _f(14, FontWeight.w600, C.ink, h: 1.4);
  static TextStyle get small => _f(12, FontWeight.w500, C.slate, h: 1.35);
  static TextStyle get smallStrong => _f(12, FontWeight.w700, C.ink, h: 1.35);
  static TextStyle get caps => _f(11, FontWeight.w700, C.primary, ls: 0.8);
  static TextStyle get capsMuted => _f(11, FontWeight.w700, C.slate, ls: 0.8);
  static TextStyle get stat => _f(24, FontWeight.w800, C.ink, h: 1.1);
  static TextStyle get button => _f(15, FontWeight.w700, Colors.white);
}
