import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/datasources/remote/conversation_api.dart';
import '../data/models/conversation_model.dart';
import '../data/models/message_model.dart';
import 'auth_provider.dart';

final conversationApiProvider = Provider<ConversationApi>(
  (ref) => ConversationApi(ref.read(apiClientProvider)),
);

class ConversationState {
  final List<Conversation> conversations;
  final String? activeId;
  final List<Message> messages;
  final bool loading;

  ConversationState({
    this.conversations = const [],
    this.activeId,
    this.messages = const [],
    this.loading = false,
  });

  Conversation? get active => activeId != null
      ? conversations.where((c) => c.id == activeId).firstOrNull
      : null;

  List<Conversation> get pinned => conversations.where((c) => c.pinned).toList();
  List<Conversation> get unpinned => conversations.where((c) => !c.pinned).toList();
}

class ConversationNotifier extends StateNotifier<ConversationState> {
  final ConversationApi _api;

  ConversationNotifier(this._api) : super(ConversationState());

  Future<void> loadConversations() async {
    state = ConversationState(
      conversations: state.conversations,
      activeId: state.activeId,
      messages: state.messages,
      loading: true,
    );
    try {
      final convs = await _api.getConversations();
      state = ConversationState(
        conversations: convs,
        activeId: state.activeId,
        messages: state.messages,
      );
    } catch (_) {
      state = ConversationState(
        conversations: state.conversations,
        activeId: state.activeId,
        messages: state.messages,
      );
    }
  }

  Future<Conversation> createConversation({
    String provider = 'auto',
    String model = 'auto',
  }) async {
    final conv = await _api.createConversation(provider: provider, model: model);
    state = ConversationState(
      conversations: [conv, ...state.conversations],
      activeId: conv.id,
      messages: [],
    );
    return conv;
  }

  Future<void> selectConversation(String id) async {
    state = ConversationState(
      conversations: state.conversations,
      activeId: id,
      messages: [],
      loading: true,
    );
    try {
      final msgs = await _api.getMessages(id);
      state = ConversationState(
        conversations: state.conversations,
        activeId: id,
        messages: msgs,
      );
    } catch (_) {
      state = ConversationState(
        conversations: state.conversations,
        activeId: id,
        messages: [],
      );
    }
  }

  Future<void> deleteConversation(String id) async {
    await _api.deleteConversation(id);
    final newActiveId = state.activeId == id ? null : state.activeId;
    state = ConversationState(
      conversations: state.conversations.where((c) => c.id != id).toList(),
      activeId: newActiveId,
      messages: newActiveId == state.activeId ? state.messages : [],
    );
  }

  Future<void> updateConversation(String id, Map<String, dynamic> data) async {
    final updated = await _api.updateConversation(id, data);
    state = ConversationState(
      conversations: state.conversations.map((c) => c.id == id ? updated : c).toList(),
      activeId: state.activeId,
      messages: state.messages,
    );
  }

  Future<void> togglePin(String id) async {
    final conv = state.conversations.firstWhere((c) => c.id == id);
    await updateConversation(id, {'is_pinned': conv.pinned ? 0 : 1});
  }

  void clearActive() {
    state = ConversationState(
      conversations: state.conversations,
      activeId: null,
      messages: [],
    );
  }

  Future<void> deleteMessage(String convId, String msgId) async {
    await _api.deleteMessage(convId, msgId);
    state = ConversationState(
      conversations: state.conversations,
      activeId: state.activeId,
      messages: state.messages.where((m) => m.id != msgId).toList(),
    );
  }

  Future<void> moveToFolder(String convId, String? folderId) async {
    await updateConversation(convId, {'folder_id': folderId});
  }

  Future<void> reloadMessages() async {
    if (state.activeId == null) return;
    final msgs = await _api.getMessages(state.activeId!);
    state = ConversationState(
      conversations: state.conversations,
      activeId: state.activeId,
      messages: msgs,
    );
  }
}

final conversationProvider = StateNotifierProvider<ConversationNotifier, ConversationState>(
  (ref) => ConversationNotifier(ref.read(conversationApiProvider)),
);
