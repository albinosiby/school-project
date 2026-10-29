import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

ThemeData darkTheme() => ThemeData(
  useMaterial3: true,
  brightness: Brightness.dark,
  colorScheme: ColorScheme.fromSeed(
    seedColor: const Color(0xFF2F4FD8),
    brightness: Brightness.dark,
  ),
  textTheme: GoogleFonts.plusJakartaSansTextTheme(ThemeData.dark().textTheme),
);
