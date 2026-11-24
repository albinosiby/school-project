import 'dart:io';
import 'dart:typed_data';

import 'package:firebase_storage/firebase_storage.dart';

class FirebaseStorageService {
  final FirebaseStorage _storage = FirebaseStorage.instance;

  /// Uploads a file straight from disk (no in-memory copy) and returns its download URL.
  Future<String> uploadLocalFile(String path, File file, {String? contentType}) async {
    final ref = _storage.ref(path);
    await ref.putFile(file, contentType != null ? SettableMetadata(contentType: contentType) : null);
    return ref.getDownloadURL();
  }

  Future<String> uploadFile(
    String path,
    Uint8List data, {
    String? contentType,
  }) async {
    final ref = _storage.ref(path);
    final metadata = contentType != null
        ? SettableMetadata(contentType: contentType)
        : null;
    await ref.putData(data, metadata);
    return ref.getDownloadURL();
  }

  Future<String> getDownloadUrl(String path) {
    return _storage.ref(path).getDownloadURL();
  }

  Future<void> deleteFile(String path) {
    return _storage.ref(path).delete();
  }
}
