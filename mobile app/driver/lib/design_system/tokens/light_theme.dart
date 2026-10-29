import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

ThemeData lightTheme() => ThemeData(
  useMaterial3: true,
  scaffoldBackgroundColor: const Color(0xFFF7F9FB),
  colorScheme: ColorScheme.fromSeed(
    seedColor: const Color(0xFF2F4FD8),
    surface: Colors.white,
  ),
  textTheme: GoogleFonts.plusJakartaSansTextTheme(),
);
