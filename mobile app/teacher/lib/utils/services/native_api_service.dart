import 'package:flutter/services.dart';

class NativeApiService {
  static const MethodChannel _channel =
      MethodChannel('com.example.flutter_blueprint/native');

  Future<String?> getPlatformVersion() async {
    try {
      final version = await _channel.invokeMethod<String>('getPlatformVersion');
      return version;
    } on PlatformException catch (e) {
      return 'Failed to get platform version: ${e.message}';
    }
  }

  Future<T?> invokeNativeMethod<T>(String method,
      [dynamic arguments]) async {
    try {
      return await _channel.invokeMethod<T>(method, arguments);
    } on PlatformException {
      return null;
    }
  }
}
