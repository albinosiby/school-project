import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../tokens/app_tokens.dart';

class AppDialogs {
  AppDialogs._();

  static Future<bool> showConfirmDialog(
    BuildContext context, {
    required String title,
    required String message,
    String confirm = 'Confirm',
    bool danger = false,
  }) async {
    final r = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(R.xl),
        ),
        backgroundColor: C.bg,
        title: Text(title, style: T.h2),
        content: Text(message, style: T.body),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel', style: T.bodyStrong.copyWith(color: C.slate)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(
              confirm,
              style: T.bodyStrong.copyWith(
                color: danger ? C.danger : C.primary,
              ),
            ),
          ),
        ],
      ),
    );
    return r ?? false;
  }

  static void showErrorDialog(BuildContext context, {required String message}) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(R.xl),
        ),
        title: Text('Error', style: T.h2),
        content: Text(message, style: T.body),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  static void showLoadingDialog(
    BuildContext context, {
    String message = 'Loading...',
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        content: Row(
          children: [
            const CircularProgressIndicator(),
            SizedBox(width: 16.w),
            Expanded(child: Text(message, style: T.body)),
          ],
        ),
      ),
    );
  }

  static void dismissLoadingDialog(BuildContext context) =>
      Navigator.of(context).pop();

  static void showSnackBar(
    BuildContext context, {
    required String message,
    bool isError = false,
  }) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            message,
            style: T.bodyStrong.copyWith(color: Colors.white),
          ),
          backgroundColor: isError ? C.danger : C.ink,
          duration: const Duration(seconds: 2),
        ),
      );
  }
}
