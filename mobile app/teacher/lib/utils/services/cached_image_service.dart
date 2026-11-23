import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

/// Downloads an image once and keeps it on disk (and in memory for the session), so a logo that takes a second
/// to fetch shows instantly on every later open. Keyed by the URL, so a new upload (new URL) refreshes it.
class CachedImageService {
  static final _memory = <String, Uint8List>{};
  static final _pending = <String, Future<Uint8List?>>{};

  static Uint8List? peek(String url) => _memory[url];

  static Future<Uint8List?> bytes(String url) {
    if (url.isEmpty) return Future.value(null);
    final hit = _memory[url];
    if (hit != null) return Future.value(hit);
    return _pending.putIfAbsent(url, () => _load(url).whenComplete(() => _pending.remove(url)));
  }

  static Future<File?> _file(String url) async {
    try {
      final dir = await getApplicationSupportDirectory();
      return File('${dir.path}/image-cache/${sha1.convert(utf8.encode(url))}.img');
    } catch (_) {
      return null; // no file system (tests, web)
    }
  }

  static Future<Uint8List?> _load(String url) async {
    final file = await _file(url);
    try {
      if (file != null && await file.exists()) {
        final data = await file.readAsBytes();
        if (data.isNotEmpty) return _memory[url] = data;
      }
    } catch (_) {}
    final fresh = await _download(url);
    if (fresh == null) return null;
    _memory[url] = fresh;
    try {
      await file?.parent.create(recursive: true);
      await file?.writeAsBytes(fresh, flush: true);
    } catch (e) {
      debugPrint('image cache write failed: $e');
    }
    return fresh;
  }

  static Future<Uint8List?> _download(String url) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 15);
    try {
      final response = await (await client.getUrl(Uri.parse(url))).close();
      if (response.statusCode != 200) return null;
      final chunks = <int>[];
      await for (final chunk in response) {
        chunks.addAll(chunk);
      }
      return Uint8List.fromList(chunks);
    } catch (e) {
      debugPrint('image download failed: $e');
      return null;
    } finally {
      client.close(force: true);
    }
  }
}
