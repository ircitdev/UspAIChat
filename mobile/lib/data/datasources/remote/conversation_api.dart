import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../models/conversation_model.dart';
import '../../models/message_model.dart';
import 'api_client.dart';

class ConversationApi {
  final ApiClient _client;
  Dio get _dio => _client.dio;

  ConversationApi(this._client);

  Future<List<Conversation>> getConversations() async {
    final response = await _dio.get(ApiConstants.conversations);
    return (response.data as List).map((e) => Conversation.fromJson(e)).toList();
  }

  Future<Conversation> createConversation({
    String title = 'New Chat',
    String provider = 'openai',
    String model = 'gpt-4o',
    String systemPrompt = '',
  }) async {
    final response = await _dio.post(ApiConstants.conversations, data: {
      'title': title,
      'provider': provider,
      'model': model,
      'system_prompt': systemPrompt,
    });
    return Conversation.fromJson(response.data);
  }

  Future<Conversation> updateConversation(String id, Map<String, dynamic> data) async {
    final response = await _dio.put(ApiConstants.conversation(id), data: data);
    return Conversation.fromJson(response.data);
  }

  Future<void> deleteConversation(String id) async {
    await _dio.delete(ApiConstants.conversation(id));
  }

  Future<List<Message>> getMessages(String conversationId) async {
    final response = await _dio.get(ApiConstants.messages(conversationId));
    return (response.data as List).map((e) => Message.fromJson(e)).toList();
  }

  Future<List<Map<String, dynamic>>> searchMessages(String query) async {
    final response = await _dio.get(ApiConstants.searchMessages, queryParameters: {'q': query});
    return (response.data as List).cast<Map<String, dynamic>>();
  }

  Future<void> deleteMessage(String convId, String msgId) async {
    await _dio.delete(ApiConstants.deleteMessage(convId, msgId));
  }

  Future<String> exportConversation(String convId, {String format = 'md'}) async {
    final response = await _dio.get(
      ApiConstants.exportConversation(convId),
      queryParameters: {'format': format},
      options: Options(responseType: ResponseType.plain),
    );
    return response.data as String;
  }
}
