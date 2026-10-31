import 'package:url_launcher/url_launcher.dart';

/// Opens external links. Abstract so tests can fake it.
abstract class LinkLauncher {
  /// Returns false when the link could not be opened (caller shows the link with a copy action).
  Future<bool> open(String url);
}

class UrlLauncherLinkLauncher implements LinkLauncher {
  @override
  Future<bool> open(String url) async {
    try {
      return await launchUrl(
        Uri.parse(url),
        mode: LaunchMode.externalApplication,
      );
    } catch (_) {
      return false;
    }
  }
}
