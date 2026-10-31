// Hand-written from the Firebase app configs. Project: school-admin-tatos-2610.
// web: "school-admin-web" app. android: reuses the parent app values until "Driver App (Android)" is registered
// (com.tatos.school.driver_app) and its google-services.json added.
// ios: PLACEHOLDERS until the iOS app is registered and its GoogleService-Info.plist is added.
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

  // TODO(flutterfire): replace the REPLACE_ME values with the iOS app's config.
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'REPLACE_ME_IOS_API_KEY',
    appId: '1:845227645501:ios:REPLACE_ME',
    messagingSenderId: '845227645501',
    projectId: 'school-admin-tatos-2610',
    storageBucket: 'school-admin-tatos-2610.firebasestorage.app',
    iosBundleId: 'tech.tatos.parentApp',
  );
}
