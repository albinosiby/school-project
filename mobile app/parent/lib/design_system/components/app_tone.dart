import 'package:flutter/material.dart';
import '../tokens/app_tokens.dart';

/// Semantic color pairs used by pills, icon tiles, progress bars and avatars.
enum Tone { brand, success, warning, danger, neutral, purple }

({Color fg, Color bg}) toneColors(Tone t) => switch (t) {
  Tone.brand => (fg: C.primary, bg: C.primarySoft),
  Tone.success => (fg: C.successDark, bg: C.successSoft),
  Tone.warning => (fg: C.warningDark, bg: C.warningSoft),
  Tone.danger => (fg: C.danger, bg: C.dangerSoft),
  Tone.purple => (fg: C.purple, bg: C.purpleSoft),
  Tone.neutral => (fg: C.slate, bg: const Color(0xFFF1F5F9)),
};
