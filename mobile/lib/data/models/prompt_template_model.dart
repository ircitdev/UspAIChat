class PromptTemplate {
  final String id;
  final String name;
  final String content;
  final String category;
  final int isGlobal;
  final int createdAt;
  final int updatedAt;

  PromptTemplate({
    required this.id,
    required this.name,
    required this.content,
    this.category = 'general',
    this.isGlobal = 0,
    required this.createdAt,
    required this.updatedAt,
  });

  factory PromptTemplate.fromJson(Map<String, dynamic> json) => PromptTemplate(
    id: json['id'] as String,
    name: json['name'] as String,
    content: json['content'] as String,
    category: json['category'] as String? ?? 'general',
    isGlobal: json['is_global'] as int? ?? 0,
    createdAt: json['created_at'] as int,
    updatedAt: json['updated_at'] as int,
  );
}
