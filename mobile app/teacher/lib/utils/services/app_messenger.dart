import 'package:flutter/material.dart';

/// The app's root ScaffoldMessenger: snack bars that do not belong to one screen (push banners, sync failures).
final rootMessengerKey = GlobalKey<ScaffoldMessengerState>();

/// What the teacher reads when the school server refuses a change. Firestore errors look like
/// `[cloud_firestore/permission-denied] The caller does not have permission…`.
String syncErrorMessage(Object error) {
  final text = '$error';
  if (text.contains('permission-denied')) {
    return 'The school server refused this change (permission denied), so it was not saved. Ask the office to check your class assignment and the app access rules.';
  }
  if (text.contains('read-only for this record')) return 'This record is read-only for you, so the change was not saved.';
  if (text.contains('recorded by another teacher')) return 'This attendance was recorded by another teacher. Contact the school office for corrections.';
  return 'Could not save to the school server: ${text.replaceFirst(RegExp(r'^(Exception|StateError|Bad state):\s*'), '').replaceFirst(RegExp(r'^\[[^\]]*\]\s*'), '')}';
}

/// Shows a refused write on whatever screen is open. Silent while no app frame exists (tests, startup).
void reportSyncError(Object error) {
  final messenger = rootMessengerKey.currentState;
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 8),
      content: Text(syncErrorMessage(error), maxLines: 4, overflow: TextOverflow.ellipsis),
    ));
}
