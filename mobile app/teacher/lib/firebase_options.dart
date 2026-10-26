// Hand-written from the Firebase app configs. Project: school-admin-tatos-2610.
// web: "school-admin-web" app. android: "Teacher App (Android)" (android/app/google-services.json).
// ios: PLACEHOLDERS until the iOS app (bundle id com.greenfield.teacherApp) is registered and its
// GoogleService-Info.plist is added.
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
    appId: '1:845227645501:android:a48908999b36b4d2c0a854',
    messagingSenderId: '845227645501',
    projectId: 'school-admin-tatos-2610',
    storageBucket: 'school-admin-tatos-2610.firebasestorage.app',
  );

  // TODO(flutterfire): replace the REPLACE_ME values with the iOS app's config.
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'REPLACE_ME_IOS_API_KEY',
    appId: '1:845227645501:ios:REPLACE_ME',
    messagingSenderId: '845227645501',
    projectId: 'school-admin-tatos-2610',
    storageBucket: 'school-admin-tatos-2610.firebasestorage.app',
    iosBundleId: 'com.greenfield.teacherApp',
  );
}
