import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../models/model_info_model.dart';
import 'api_client.dart';

class ModelApi {
  final ApiClient _client;
  Dio get _dio => _client.dio;

  ModelApi(this._client);

  Future<ModelsMap> getModels() async {
    final response = await _dio.get(ApiConstants.models);
    return parseModelsMap(response.data);
  }

  Future<Map<String, dynamic>> getKeyStatus() async {
    final response = await _dio.get(ApiConstants.modelKeys);
    return response.data as Map<String, dynamic>;
  }

  Future<void> saveKey(String provider, String apiKey, {String? baseUrl}) async {
    await _dio.post(ApiConstants.modelKeys, data: {
      'provider': provider,
      'api_key': apiKey,
      if (baseUrl != null) 'base_url': baseUrl,
    });
  }

  Future<void> deleteKey(String provider) async {
    await _dio.delete(ApiConstants.modelKey(provider));
  }
}
