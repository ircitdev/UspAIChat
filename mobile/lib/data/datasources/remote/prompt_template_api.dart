import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../models/prompt_template_model.dart';
import 'api_client.dart';

class PromptTemplateApi {
  final ApiClient _client;
  Dio get _dio => _client.dio;

  PromptTemplateApi(this._client);

  Future<List<PromptTemplate>> getTemplates() async {
    final response = await _dio.get(ApiConstants.promptTemplates);
    return (response.data as List).map((e) => PromptTemplate.fromJson(e)).toList();
  }

  Future<PromptTemplate> createTemplate({required String name, required String content, String category = 'general'}) async {
    final response = await _dio.post(ApiConstants.promptTemplates, data: {
      'name': name, 'content': content, 'category': category,
    });
    return PromptTemplate.fromJson(response.data);
  }

  Future<PromptTemplate> updateTemplate(String id, Map<String, dynamic> data) async {
    final response = await _dio.put(ApiConstants.promptTemplate(id), data: data);
    return PromptTemplate.fromJson(response.data);
  }

  Future<void> deleteTemplate(String id) async {
    await _dio.delete(ApiConstants.promptTemplate(id));
  }
}
