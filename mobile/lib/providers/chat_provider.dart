import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/datasources/remote/chat_api.dart';
import '../data/models/sse_event_model.dart';
import 'auth_provider.dart';
import 'conversation_provider.dart';

final chatApiProvider = Provider<ChatApi>(
  (ref) => ChatApi(ref.read(apiClientProvider)),
);

class ChatState {
  final bool streaming;
  final String streamingContent;
  final int tokenCount;
  final String? error;
  final SseRoutingInfo? routingInfo;

  ChatState({
    this.streaming = false,
    this.streamingContent = '',
    this.tokenCount = 0,
    this.error,
    this.routingInfo,
  });
}

class ChatNotifier extends StateNotifier<ChatState> {
  final ChatApi _chatApi;
  final Ref _ref;
  CancelToken? _cancelToken;

  ChatNotifier(this._chatApi, this._ref) : super(ChatState());

  Future<void> sendMessage({
    required String conversationId,
    required String message,
    required String provider,
    required String model,
    String? systemPrompt,
    List<Map<String, dynamic>>? files,
  }) async {
    _cancelToken = CancelToken();
    state = ChatState(streaming: true);

    try {
      await _chatApi.streamChat(
        conversationId: conversationId,
        message: message,
        provider: provider,
        model: model,
        systemPrompt: systemPrompt,
        files: files,
        cancelToken: _cancelToken,
        onEvent: (event) {
          switch (event) {
            case SseRoutingInfo():
              state = ChatState(
                streaming: true,
                streamingContent: state.streamingContent,
                tokenCount: state.tokenCount,
                routingInfo: event,
              );
            case SseChunk(:final content):
              state = ChatState(
                streaming: true,
                streamingContent: state.streamingContent + content,
                tokenCount: state.tokenCount,
                routingInfo: state.routingInfo,
              );
            case SseTokens(:final count):
              state = ChatState(
                streaming: true,
                streamingContent: state.streamingContent,
                tokenCount: count,
                routingInfo: state.routingInfo,
              );
            case SseDone(:final balanceAfter):
              if (balanceAfter != null) {
                _ref.read(authProvider.notifier).updateBalance(balanceAfter);
              }
              state = ChatState(tokenCount: state.tokenCount);
              _ref.read(conversationProvider.notifier).reloadMessages();
              _ref.read(conversationProvider.notifier).loadConversations();
            case SseError(:final error):
              state = ChatState(error: error);
            default:
              break;
          }
        },
      );
    } catch (e) {
      if (e is DioException && e.type == DioExceptionType.cancel) return;
      state = ChatState(error: e.toString());
    }
  }

  void cancelStream() {
    _cancelToken?.cancel();
    state = ChatState();
  }
}

final chatProvider = StateNotifierProvider<ChatNotifier, ChatState>(
  (ref) => ChatNotifier(ref.read(chatApiProvider), ref),
);
