import 'dart:io';

import 'package:dio/dio.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

/// Downloads a shared document into the app cache (once) and opens it in the phone's own viewer,
/// instead of sending the user to a browser. Returns null on success, else a message for the user.
typedef OpenDocumentFn = Future<String?> Function({required String url, required String name, String key});

/// Replaceable in tests.
OpenDocumentFn openDocument = _openDocument;

final _inFlight = <String, Future<String?>>{};

Future<String?> _openDocument({required String url, required String name, String key = ''}) {
  final id = _safe(key.isNotEmpty ? key : Uri.tryParse(url)?.path ?? url);
  // a double tap while downloading waits for the same download
  return _inFlight[id] ??= _download(url, name, id).whenComplete(() => _inFlight.remove(id));
}

Future<String?> _download(String url, String name, String id) async {
  try {
    final dir = Directory('${(await getApplicationCacheDirectory()).path}/docs/$id');
    final file = File('${dir.path}/${_safe(name.isEmpty ? 'document' : name)}');
    if (!await file.exists() || await file.length() == 0) {
      await dir.create(recursive: true);
      final part = File('${file.path}.part');
      await Dio().download(url, part.path);
      await part.rename(file.path);
    }
    final r = await OpenFilex.open(file.path);
    return switch (r.type) {
      ResultType.done => null,
      ResultType.noAppToOpen => 'No app on this phone can open ${_ext(name)} files',
      _ => "Couldn't open $name",
    };
  } on DioException {
    return "Couldn't download $name. Check your connection.";
  } catch (_) {
    return "Couldn't open $name";
  }
}

String _ext(String name) {
  final i = name.lastIndexOf('.');
  return i < 0 ? 'these' : name.substring(i + 1).toUpperCase();
}

String _safe(String s) {
  final out = s.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
  return out.length > 100 ? out.substring(out.length - 100) : out;
}
