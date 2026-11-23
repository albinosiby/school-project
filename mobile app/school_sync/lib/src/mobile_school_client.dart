import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'school_policy.dart';

class MobileSchoolException implements Exception {
  const MobileSchoolException(this.message);
  final String message;
  @override
  String toString() => message;
}

class MobileSchoolClient {
  MobileSchoolClient({
    required this.auth,
    required this.db,
    this.emulator = false,
    this.emulatorHost = '127.0.0.1',
    this.emulatorUsb = false,
  });
  final FirebaseAuth auth;
  final FirebaseFirestore db;
  final bool emulator, emulatorUsb;
  final String emulatorHost;
  String get _host =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android && !emulatorUsb && ['localhost', '127.0.0.1'].contains(emulatorHost)
      ? '10.0.2.2'
      : emulatorHost;
  Future<Map<String, dynamic>> call(String name, [Map<String, dynamic> input = const {}]) async {
    final token = await auth.currentUser?.getIdToken();
    if (token == null) throw const MobileSchoolException('Sign in again.');
    final project = auth.app.options.projectId;
    final url = emulator
        ? Uri(scheme: 'http', host: _host, port: 5001, path: '/$project/asia-south1/$name')
        : Uri.https('asia-south1-$project.cloudfunctions.net', '/$name');
    final response = await http
        .post(url, headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'}, body: jsonEncode({'data': input}))
        .timeout(Duration(seconds: name == 'getMobileSchoolContext' ? 125 : 40));
    Map? result;
    try {
      result = jsonDecode(response.body) as Map;
    } catch (_) {
      /* Map a proxy/service error below. */
    }
    if (response.statusCode != 200 || result?['result'] is! Map)
      throw MobileSchoolException('${(result?['error'] as Map?)?['message'] ?? 'The school service is unavailable. Please try again.'}');
    return Map<String, dynamic>.from(result!['result'] as Map);
  }

  Stream<SchoolPolicy> watchPolicy(String schoolId) async* {
    // Bootstrap schools configured before the mobile projection was deployed.
    final cached = await db.doc('schools/$schoolId/school/mobile').get();
    if (!cached.exists) yield SchoolPolicy.fromJson(await call('getMobileSchoolContext'));
    yield* db.doc('schools/$schoolId/school/mobile').snapshots().map((s) => SchoolPolicy.fromJson(s.data() ?? const {}));
  }

  Future<String> documentLink({required String studentId, required String kind, required String documentId}) async {
    final result = await call('downloadMobileFeeDocument', {'studentId': studentId, 'kind': kind, 'documentId': documentId});
    final uri = Uri.tryParse('${result['url'] ?? ''}');
    if (uri == null || (uri.scheme != 'https' && !(emulator && uri.scheme == 'http')))
      throw const MobileSchoolException('The document link is unavailable.');
    return reachableUrl(uri.toString());
  }

  String reachableUrl(String url) =>
      emulator ? url.replaceFirst('://localhost:', '://$_host:').replaceFirst('://127.0.0.1:', '://$_host:') : url;
}
