import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// Numeric field with − / + buttons (Figma "Section Breakdown" steppers). The value is clamped to
/// [min]..[max] by the buttons; typed values are reported as-is so callers can validate.
/// An empty field reports null.
class AppNumberStepper extends StatelessWidget {
  const AppNumberStepper({super.key, required this.controller, required this.onChanged, this.min = 0, required this.max, this.step = 1, this.label = 'value', this.error = false});
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final int min, max, step;
  final String label;
  final bool error;

  void _bump(int d) {
    final cur = int.tryParse(controller.text) ?? (d > 0 ? min - step : min);
    final next = (cur + d).clamp(min, max);
    controller.text = '$next';
    onChanged('$next');
  }

  @override
  Widget build(BuildContext context) {
    Widget btn(IconData icon, String tip, int d) => Semantics(
          button: true, label: tip,
          child: InkWell(
            borderRadius: BorderRadius.circular(R.md),
            onTap: () => _bump(d),
            child: Container(
              width: 44.r, height: 44.r,
              decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.md), border: Border.all(color: C.border)),
              child: Icon(icon, size: 20.r, color: C.ink),
            ),
          ),
        );
    return Row(mainAxisSize: MainAxisSize.min, children: [
      btn(Icons.remove_rounded, 'Decrease $label', -step),
      SizedBox(width: 8.w),
      SizedBox(
        width: 58.w,
        child: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(3)],
          onChanged: onChanged,
          style: T.h3.copyWith(color: C.primary),
          decoration: InputDecoration(
            hintText: '--', isDense: true,
            contentPadding: EdgeInsets.symmetric(vertical: 11.h),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(R.md), borderSide: BorderSide(color: error ? C.danger : C.border)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(R.md), borderSide: BorderSide(color: error ? C.danger : C.primary, width: 1.5)),
          ),
        ),
      ),
      SizedBox(width: 8.w),
      btn(Icons.add_rounded, 'Increase $label', step),
    ]);
  }
}
