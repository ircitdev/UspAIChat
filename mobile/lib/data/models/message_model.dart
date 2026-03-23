import 'dart:convert';

class FileAttachment {
  final String id;
  final String filename;
  final String path;
  final String mimetype;
  final int size;
  final String? base64Data;

  FileAttachment({
    required this.id,
    required this.filename,
    required this.path,
    required this.mimetype,
    this.size = 0,
    this.base64Data,
  });

  bool get isImage => mimetype.startsWith('image/');

  factory FileAttachment.fromJson(Map<String, dynamic> json) => FileAttachment(
    id: json['id'] as String,
    filename: json['filename'] as String,
    path: json['path'] as String,
    mimetype: json['mimetype'] as String,
    size: json['size'] as int? ?? 0,
    base64Data: json['base64'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'filename': filename,
    'path': path,
    'mimetype': mimetype,
    'size': size,
    if (base64Data != null) 'base64': base64Data,
  };
}

class Message {
  final String id;
  final String conversationId;
  final String role;
  final String content;
  final int createdAt;
  final int tokenCount;
  final String? provider;
  final String? model;
  final List<FileAttachment> files;
  final double? cost;

  Message({
    required this.id,
    required this.conversationId,
    required this.role,
    required this.content,
    required this.createdAt,
    this.tokenCount = 0,
    this.provider,
    this.model,
    this.files = const [],
    this.cost,
  });

  bool get isUser => role == 'user';
  bool get isAssistant => role == 'assistant';

  factory Message.fromJson(Map<String, dynamic> json) {
    final filesRaw = json['files'];
    List<FileAttachment> files = [];
    if (filesRaw is String && filesRaw.isNotEmpty) {
      final decoded = jsonDecode(filesRaw) as List;
      files = decoded.map((e) => FileAttachment.fromJson(e)).toList();
    } else if (filesRaw is List) {
      files = filesRaw.map((e) => FileAttachment.fromJson(e)).toList();
    }

    return Message(
      id: json['id'] as String,
      conversationId: json['conversation_id'] as String,
      role: json['role'] as String,
      content: json['content'] as String,
      createdAt: json['created_at'] as int,
      tokenCount: json['token_count'] as int? ?? 0,
      provider: json['provider'] as String?,
      model: json['model'] as String?,
      files: files,
      cost: (json['cost'] as num?)?.toDouble(),
    );
  }
}
