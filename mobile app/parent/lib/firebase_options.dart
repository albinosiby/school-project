// Hand-written from the Firebase app configs. Project: school-admin-tatos-2610.
// web: "school-admin-web" app. android: "Parent App (Android)" (android/app/google-services.json).
// ios: "Parent App (iOS)" (tech.tatos.parentApp).
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
    appId: '1:845227645501:android:6a7be14f6073d9a9c0a854',
    messagingSenderId: '845227645501',
    projectId: 'school-admin-tatos-2610',
    storageBucket: 'school-admin-tatos-2610.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyBq7CjG5ZDfeLqroLyZNg3KNPYERXXlzlQ',
    appId: '1:845227645501:ios:58944417c1403b4ac0a854',
    messagingSenderId: '845227645501',
    projectId: 'school-admin-tatos-2610',
    storageBucket: 'school-admin-tatos-2610.firebasestorage.app',
    iosClientId: '845227645501-3qb6hrojq185n8o8p0oclla9sd6u13gd.apps.googleusercontent.com',
    iosBundleId: 'tech.tatos.parentApp',
  );
}
