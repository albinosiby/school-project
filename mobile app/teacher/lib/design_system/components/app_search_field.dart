import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

class AppSearchField extends StatelessWidget {
  const AppSearchField({super.key, required this.hint, required this.onChanged, this.trailing, this.controller});
  final String hint;
  final ValueChanged<String> onChanged;
  final Widget? trailing;
  final TextEditingController? controller;
  @override
  Widget build(BuildContext context) {
    OutlineInputBorder b() => OutlineInputBorder(borderRadius: BorderRadius.circular(R.lg), borderSide: const BorderSide(color: C.panelBorder));
    return Row(children: [
      Expanded(
        child: TextField(
          controller: controller, onChanged: onChanged, style: T.bodyStrong.copyWith(fontWeight: FontWeight.w500),
          decoration: InputDecoration(hintText: hint, prefixIcon: Icon(Icons.search_rounded, color: C.primary, size: 22.r), fillColor: C.panel, border: b(), enabledBorder: b()),
        ),
      ),
      if (trailing != null) ...[SizedBox(width: 10.w), trailing!],
    ]);
  }
}
