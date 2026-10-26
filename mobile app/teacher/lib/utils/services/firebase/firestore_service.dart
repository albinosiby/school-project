import 'package:cloud_firestore/cloud_firestore.dart';

class FirestoreService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  CollectionReference<Map<String, dynamic>> collection(String path) =>
      _firestore.collection(path);

  Future<DocumentSnapshot<Map<String, dynamic>>> getDocument(
    String collection,
    String docId,
  ) {
    return _firestore.collection(collection).doc(docId).get();
  }

  Future<QuerySnapshot<Map<String, dynamic>>> getCollection(String path) {
    return _firestore.collection(path).get();
  }

  Future<DocumentReference<Map<String, dynamic>>> addDocument(
    String collection,
    Map<String, dynamic> data,
  ) {
    return _firestore.collection(collection).add(data);
  }

  Future<void> updateDocument(
    String collection,
    String docId,
    Map<String, dynamic> data,
  ) {
    return _firestore.collection(collection).doc(docId).update(data);
  }

  Future<void> deleteDocument(String collection, String docId) {
    return _firestore.collection(collection).doc(docId).delete();
  }
}
