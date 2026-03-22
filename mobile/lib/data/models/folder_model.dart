class Folder {
  final String id;
  final String name;
  final String color;
  final int sortOrder;
  final int createdAt;

  Folder({
    required this.id,
    required this.name,
    this.color = '#8b5cf6',
    this.sortOrder = 0,
    required this.createdAt,
  });

  factory Folder.fromJson(Map<String, dynamic> json) => Folder(
    id: json['id'] as String,
    name: json['name'] as String,
    color: json['color'] as String? ?? '#8b5cf6',
    sortOrder: json['sort_order'] as int? ?? 0,
    createdAt: json['created_at'] as int,
  );
}
