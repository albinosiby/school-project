import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

/// Labelled text field with validation and optional password toggle.
class AppTextField extends StatefulWidget {
  const AppTextField({
    super.key,
    required this.label,
    this.controller,
    this.hint,
    this.maxLines = 1,
    this.validator,
    this.keyboard,
    this.readOnly = false,
    this.onTap,
    this.suffix,
    this.onChanged,
    this.initial,
    this.obscure = false,
    this.maxLength,
  });
  final String label;
  final TextEditingController? controller;
  final String? hint, initial;
  final int maxLines;
  final int? maxLength;
  final String? Function(String?)? validator;
  final TextInputType? keyboard;
  final bool readOnly, obscure;
  final VoidCallback? onTap;
  final Widget? suffix;
  final ValueChanged<String>? onChanged;
  @override
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  late bool _hidden = widget.obscure;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 14.h),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: T.smallStrong.copyWith(color: C.slate)),
        SizedBox(height: 6.h),
        TextFormField(
          controller: widget.controller,
          initialValue: widget.controller == null ? widget.initial : null,
          maxLines: widget.obscure ? 1 : widget.maxLines,
          maxLength: widget.maxLength,
          validator: widget.validator,
          keyboardType: widget.keyboard,
          readOnly: widget.readOnly,
          onTap: widget.onTap,
          onChanged: widget.onChanged,
          obscureText: _hidden,
          style: T.bodyStrong.copyWith(fontWeight: FontWeight.w500),
          decoration: InputDecoration(
            hintText: widget.hint,
            suffixIcon: widget.obscure
                ? IconButton(
                    tooltip: _hidden ? 'Show' : 'Hide',
                    icon: Icon(
                      _hidden
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      size: 20.r,
                    ),
                    onPressed: () => setState(() => _hidden = !_hidden),
                  )
                : widget.suffix,
          ),
        ),
      ],
    ),
  );
}

class AppDropdown<V> extends StatelessWidget {
  const AppDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    this.labelOf,
  });
  final String label;
  final V value;
  final List<V> items;
  final ValueChanged<V> onChanged;
  final String Function(V)? labelOf;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: 14.h),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: T.smallStrong.copyWith(color: C.slate)),
        SizedBox(height: 6.h),
        DropdownButtonFormField<V>(
          initialValue: value,
          isExpanded: true,
          borderRadius: BorderRadius.circular(R.md),
          icon: Icon(Icons.keyboard_arrow_down_rounded, size: 22.r),
          items: [
            for (final i in items)
              DropdownMenuItem(
                value: i,
                child: Text(
                  labelOf?.call(i) ?? '$i',
                  style: T.bodyStrong.copyWith(fontWeight: FontWeight.w500),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
          onChanged: (v) {
            if (v != null) onChanged(v);
          },
        ),
      ],
    ),
  );
}
