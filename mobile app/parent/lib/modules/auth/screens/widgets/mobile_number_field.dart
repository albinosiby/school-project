import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../design_system/design_system.dart';

/// 10-digit Indian mobile number with a fixed +91 prefix.
class MobileNumberField extends StatelessWidget {
  const MobileNumberField({
    super.key,
    required this.controller,
    this.helper,
    this.fieldKey,
  });
  final TextEditingController controller;
  final String? helper;
  final Key? fieldKey;

  static String? validate(String? v) {
    final d = (v ?? '').replaceAll(RegExp(r'\D'), '');
    if (d.isEmpty) return 'Mobile number is required';
    return d.length == 10 ? null : 'Enter a valid 10-digit mobile number';
  }

  @override
  Widget build(BuildContext context) => TextFormField(
    key: fieldKey,
    controller: controller,
    keyboardType: TextInputType.phone,
    autofillHints: const [AutofillHints.telephoneNumberNational],
    inputFormatters: [
      FilteringTextInputFormatter.digitsOnly,
      LengthLimitingTextInputFormatter(10),
    ],
    validator: validate,
    style: T.bodyStrong.copyWith(fontSize: 15.sp),
    decoration: InputDecoration(
      hintText: '98765 43210',
      helperText: helper,
      helperStyle: T.small.copyWith(color: C.muted, fontSize: 11.sp),
      prefixIcon: Container(
        margin: EdgeInsets.only(right: 10.w),
        padding: EdgeInsets.symmetric(horizontal: 12.w),
        decoration: const BoxDecoration(
          border: Border(right: BorderSide(color: C.border)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('IN', style: T.smallStrong.copyWith(color: C.slate)),
            SizedBox(width: 6.w),
            Text('+91', style: T.bodyStrong),
          ],
        ),
      ),
      prefixIconConstraints: BoxConstraints(minHeight: 24.h),
      suffixIcon: Icon(Icons.smartphone_rounded, size: 20.r, color: C.muted),
    ),
  );
}
