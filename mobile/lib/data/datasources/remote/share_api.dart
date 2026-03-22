import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import 'api_client.dart';

class ShareApi {
  final ApiClient _client;
  Dio get _dio => _client.dio;

  ShareApi(this._client);

  Future<Map<String, dynamic>> shareConversation(String convId, {String? password}) async {
    final response = await _dio.post(ApiConstants.shareConversation(convId), data: {
      if (password != null) 'password': password,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> getShareStatus(String convId) async {
    final response = await _dio.get(ApiConstants.shareStatus(convId));
    return response.data;
  }

  Future<void> unshareConversation(String convId) async {
    await _dio.delete(ApiConstants.shareConversation(convId));
  }

  Future<Map<String, dynamic>> getPublicShare(String shareId, {String? password}) async {
    final response = await _dio.get(
      ApiConstants.sharePublic(shareId),
      queryParameters: {if (password != null) 'password': password},
    );
    return response.data;
  }
}
