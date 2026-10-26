import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';
import 'app_tone.dart';

class AppProgress extends StatelessWidget {
  const AppProgress(this.value, {super.key, this.tone = Tone.brand, this.height = 8});
  final double value;
  final Tone tone;
  final double height;
  @override
  Widget build(BuildContext context) {
    final fg = tone == Tone.brand ? C.primary : toneColors(tone).fg;
    return ClipRRect(
      borderRadius: BorderRadius.circular(R.pill),
      child: LinearProgressIndicator(value: value.clamp(0, 1), minHeight: height.h, color: fg, backgroundColor: const Color(0xFFE5EDFB)),
    );
  }
}
