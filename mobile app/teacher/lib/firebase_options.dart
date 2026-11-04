// Hand-written from the Firebase app configs. Project: school-admin-tatos-2610.
// web: "school-admin-web" app. android: "Teacher App (Android)" (android/app/google-services.json).
// ios: "Teacher App (iOS)" (tatos.tech.teacherApp).
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform, kIsWeb;

class DefaultFirebaseOptions {
  DefaultFirebaseOptions._();

  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    return switch (defaultTargetPlatform) {
      TargetPlatform.android => android,
      TargetPlatform.iOS => ios,
      _ => throw UnsupportedError('Firebase options are not configured for $defaultTargetPlatform.'),
    };
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyCwy3Xf7qxyWLX34oeslxdvHnriM5_yeO8',
    appId: '1:845227645501:web:b479eae603082a45c0a854',
    messagingSenderId: '845227645501',
    projectId: 'school-admin-tatos-2610',
    authDomain: 'school-admin-tatos-2610.firebaseapp.com',
    storageBucket: 'school-admin-tatos-2610.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyCheKR9AdiJhLrKcwc0wTU8dvrTuCGqawk',
    appId: '1:845227645501:android:5d5931311f2f6229c0a854',
    messagingSenderId: '845227645501',
    projectId: 'school-admin-tatos-2610',
    storageBucket: 'school-admin-tatos-2610.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyBq7CjG5ZDfeLqroLyZNg3KNPYERXXlzlQ',
    appId: '1:845227645501:ios:1d92b7fec9cb137ac0a854',
    messagingSenderId: '845227645501',
    projectId: 'school-admin-tatos-2610',
    storageBucket: 'school-admin-tatos-2610.firebasestorage.app',
    iosClientId: '845227645501-a6nej5a5rasf5ad08rkv70g5k617d3sp.apps.googleusercontent.com',
    iosBundleId: 'tatos.tech.teacherApp',
  );
}
