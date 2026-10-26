import 'package:url_launcher/url_launcher.dart';

/// Opens [uri] outside the app (Meet app / browser / WhatsApp). Returns false when nothing could handle it.
typedef LaunchFn = Future<bool> Function(Uri uri);

Future<bool> _launch(Uri uri) async {
  try {
    return await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    return false;
  }
}

/// Replaceable in tests.
LaunchFn launchExternal = _launch;
