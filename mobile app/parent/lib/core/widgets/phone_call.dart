import 'package:flutter/material.dart';
import '../../design_system/design_system.dart';
import '../../di/injection.dart';
import '../../utils/services/link_launcher.dart';

/// `tel:` link for a display number ("+91 98100 44092" -> "tel:+919810044092"); null when there is no number.
String? telUri(String phone) {
  final n = phone.replaceAll(RegExp(r'[^0-9+]'), '');
  return n.replaceAll('+', '').isEmpty ? null : 'tel:$n';
}

/// Opens the dialer for [phone] through [LinkLauncher]; when the device cannot place calls the number is shown instead.
Future<void> callPhone(BuildContext context, String name, String phone) async {
  final uri = telUri(phone);
  if (uri == null) {
    AppDialogs.showSnackBar(context, message: 'No phone number on record for $name');
    return;
  }
  final ok = await getIt<LinkLauncher>().open(uri);
  if (!context.mounted) return;
  AppDialogs.showSnackBar(context, message: ok ? 'Calling $name ($phone)' : 'Call $name on $phone');
}
