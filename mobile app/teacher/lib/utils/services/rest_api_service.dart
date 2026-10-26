import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../../constants/api_path.dart';
import '../../constants/app_constants.dart';
import '../exceptions/app_exception.dart';
import 'secure_storage_service.dart';

class ApiException extends AppException {
  ApiException({required super.message, super.statusCode, super.data});

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class RestApiService {
  late final Dio _dio;
  final SecureStorageService _secureStorage;

  RestApiService(this._secureStorage) {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiPaths.baseUrl,
        connectTimeout: AppConstants.connectionTimeout,
        receiveTimeout: AppConstants.receiveTimeout,
        headers: {'Content-Type': 'application/json'},
      ),
    );
    _initInterceptors();
  }

  void _initInterceptors() {
    // Auth interceptor
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _secureStorage.getToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) {
          handler.next(error);
        },
      ),
    );

    // Logging interceptor (debug only)
    if (kDebugMode) {
      _dio.interceptors.add(
        LogInterceptor(
          requestBody: true,
          responseBody: true,
        ),
      );
    }
  }

  Future<Response> get(String path,
      {Map<String, dynamic>? queryParameters}) async {
    try {
      return await _dio.get(path, queryParameters: queryParameters);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Response> post(String path, {dynamic data}) async {
    try {
      return await _dio.post(path, data: data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Response> put(String path, {dynamic data}) async {
    try {
      return await _dio.put(path, data: data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<Response> delete(String path) async {
    try {
      return await _dio.delete(path);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  ApiException _handleError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiException(
          message: 'Connection timed out',
          statusCode: error.response?.statusCode,
        );
      case DioExceptionType.badResponse:
        return ApiException(
          message: error.response?.data?['message'] ?? 'Server error',
          statusCode: error.response?.statusCode,
          data: error.response?.data,
        );
      case DioExceptionType.connectionError:
        return ApiException(message: 'No internet connection');
      default:
        return ApiException(
          message: error.message ?? 'Something went wrong',
        );
    }
  }
}
