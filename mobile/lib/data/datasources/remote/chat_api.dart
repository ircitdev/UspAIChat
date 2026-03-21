import 'dart:convert';
import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../models/sse_event_model.dart';
import 'api_client.dart';

class ChatApi {
  final ApiClient _client;
  Dio get _dio => _client.dio;

  ChatApi(this._client);

  Future<void> streamChat({
    required String conversationId,
    required String message,
    required String provider,
    required String model,
    String? systemPrompt,
    List<Map<String, dynamic>>? files,
    required void Function(SseEvent event) onEvent,
    CancelToken? cancelToken,
  }) async {
    final response = await _dio.post(
      ApiConstants.chatStream,
      data: {
        'conversation_id': conversationId,
        'message': message,
        'provider': provider,
        'model': model,
        if (systemPrompt != null && systemPrompt.isNotEmpty) 'system_prompt': systemPrompt,
        if (files != null && files.isNotEmpty) 'files': files,
      },
      options: Options(
        responseType: ResponseType.stream,
        receiveTimeout: const Duration(minutes: 5),
      ),
      cancelToken: cancelToken,
    );

    final stream = (response.data as ResponseBody).stream;
    String buffer = '';

    await for (final bytes in stream) {
      buffer += utf8.decode(bytes);
      final lines = buffer.split('\n');
      buffer = lines.removeLast();

      for (final line in lines) {
        if (line.startsWith('data: ')) {
          try {
            final json = jsonDecode(line.substring(6)) as Map<String, dynamic>;
            onEvent(SseEvent.fromJson(json));
          } catch (_) {}
        }
      }
    }
  }
}
