import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../utils/services/data_store.dart';
import '../../../utils/services/firebase/firebase_storage_service.dart';
import '../models/attachment_models.dart';

/// Who the chat services act for: the school and the signed-in login. Resolved lazily so the services can be
/// registered before sign-in.
typedef ChatIdentity = ({String schoolId, String uid})? Function();

/// Uploads chat attachments (photos, documents, voice notes) and keeps the "I am in this chat" presence that
/// lets the server skip the push for a message you are already looking at.
abstract class IChatMediaRepository {
  /// Uploads the local file and returns the attachment reference to send. Throws when the backend has no storage.
  Future<FileRef> upload({
    required String threadId,
    required String path,
    required String name,
    required String kind,
    int durationMs = 0,
  });

  /// Uploads a worksheet / notes file for a live class (Storage `schools/{sid}/live-classes/{uid}/…`, readable by the
  /// school's parents and teachers) and returns its reference.
  Future<FileRef> uploadMaterial({required String path, required String name, String folder = 'live-classes'});

  /// Marks the login as reading [threadId] (null = left the chat). Best effort, never throws.
  Future<void> setPresence(String? threadId);
}

/// Local backend: nothing is uploaded; files are referenced by their local path so the demo still shows them.
class LocalChatMediaRepository implements IChatMediaRepository {
  @override
  Future<FileRef> upload({
    required String threadId,
    required String path,
    required String name,
    required String kind,
    int durationMs = 0,
  }) async {
    final bytes = File(path).existsSync() ? File(path).lengthSync() : 0;
    return FileRef(
      name: name,
      kind: kind,
      url: path,
      path: path,
      bytes: bytes,
      durationMs: durationMs,
      contentType: contentTypeOf(name),
    );
  }

  @override
  Future<FileRef> uploadMaterial({required String path, required String name, String folder = 'live-classes'}) =>
      upload(threadId: 'material', path: path, name: name, kind: 'file');

  @override
  Future<void> setPresence(String? threadId) async {}
}

/// Firebase: Storage path `schools/{sid}/chat/{threadId}/{id}` (rules: the thread's teacher and guardians),
/// presence doc `schools/{sid}/msg_presence/{uid}`.
class FirebaseChatMediaRepository implements IChatMediaRepository {
  FirebaseChatMediaRepository(this._storage, this._identity, [FirebaseFirestore? firestore]) : _fs = firestore;
  final FirebaseStorageService _storage;
  final ChatIdentity _identity;
  final FirebaseFirestore? _fs;
  FirebaseFirestore get _db => _fs ?? FirebaseFirestore.instance;

  @override
  Future<FileRef> upload({
    required String threadId,
    required String path,
    required String name,
    required String kind,
    int durationMs = 0,
  }) async {
    final me = _identity();
    if (me == null) throw StateError('Sign in to share files.');
    final file = File(path);
    final contentType = contentTypeOf(name, fallback: kind == 'audio' ? 'audio/mp4' : 'application/octet-stream');
    final id = uid('att');
    final storagePath = 'schools/${me.schoolId}/chat/$threadId/$id';
    // streamed from disk: one upload request plus the URL lookup, nothing copied into memory first
    final url = await _storage.uploadLocalFile(storagePath, file, contentType: contentType);
    return FileRef(
      name: name,
      kind: kind,
      url: url,
      path: storagePath,
      bytes: await file.length(),
      durationMs: durationMs,
      contentType: contentType,
    );
  }

  @override
  Future<FileRef> uploadMaterial({required String path, required String name, String folder = 'live-classes'}) async {
    final me = _identity();
    if (me == null) throw StateError('Sign in to attach files.');
    final file = File(path);
    final contentType = contentTypeOf(name, fallback: 'application/octet-stream');
    // live-classes (class notes) or lesson-plans (plan attachments): same rules, one folder per teacher
    final storagePath = 'schools/${me.schoolId}/$folder/${me.uid}/${uid('mat')}';
    final url = await _storage.uploadLocalFile(storagePath, file, contentType: contentType);
    return FileRef(
      name: name,
      kind: 'file',
      url: url,
      path: storagePath,
      bytes: await file.length(),
      contentType: contentType,
    );
  }

  @override
  Future<void> setPresence(String? threadId) async {
    final me = _identity();
    if (me == null) return;
    try {
      await _db.doc('schools/${me.schoolId}/msg_presence/${me.uid}').set({
        'uid': me.uid,
        'threadId': threadId ?? '',
        'at': DateTime.now().toUtc().toIso8601String(),
      });
    } catch (_) {
      // presence only tunes notifications; never block the chat on it
    }
  }
}

/// MIME type from the file name (chat allows images, PDFs, Office files, text and audio).
String contentTypeOf(String name, {String fallback = 'application/octet-stream'}) {
  final ext = name.contains('.') ? name.split('.').last.toLowerCase() : '';
  return switch (ext) {
    'jpg' || 'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'webp' => 'image/webp',
    'gif' => 'image/gif',
    'heic' => 'image/heic',
    'pdf' => 'application/pdf',
    'doc' => 'application/msword',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls' => 'application/vnd.ms-excel',
    'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt' => 'application/vnd.ms-powerpoint',
    'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt' => 'text/plain',
    'm4a' => 'audio/mp4',
    'aac' => 'audio/aac',
    'mp3' => 'audio/mpeg',
    'ogg' => 'audio/ogg',
    'wav' => 'audio/wav',
    _ => fallback,
  };
}
