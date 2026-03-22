class Conversation {
  final String id;
  final String title;
  final String provider;
  final String model;
  final String systemPrompt;
  final int createdAt;
  final int updatedAt;
  final int tokenCount;
  final int isPinned;
  final String? folderId;
  final String? lastMessage;
  final int? messageCount;

  Conversation({
    required this.id,
    required this.title,
    required this.provider,
    required this.model,
    this.systemPrompt = '',
    required this.createdAt,
    required this.updatedAt,
    this.tokenCount = 0,
    this.isPinned = 0,
    this.folderId,
    this.lastMessage,
    this.messageCount,
  });

  bool get pinned => isPinned == 1;

  factory Conversation.fromJson(Map<String, dynamic> json) => Conversation(
    id: json['id'] as String,
    title: json['title'] as String,
    provider: json['provider'] as String,
    model: json['model'] as String,
    systemPrompt: json['system_prompt'] as String? ?? '',
    createdAt: json['created_at'] as int,
    updatedAt: json['updated_at'] as int,
    tokenCount: json['token_count'] as int? ?? 0,
    isPinned: json['is_pinned'] as int? ?? 0,
    folderId: json['folder_id'] as String?,
    lastMessage: json['last_message'] as String?,
    messageCount: json['message_count'] as int?,
  );
}
