class ModelInfo {
  final String id;
  final String name;
  final int context;

  ModelInfo({required this.id, required this.name, required this.context});

  factory ModelInfo.fromJson(Map<String, dynamic> json) => ModelInfo(
    id: json['id'] as String,
    name: json['name'] as String,
    context: json['context'] as int,
  );
}

typedef ModelsMap = Map<String, List<ModelInfo>>;

ModelsMap parseModelsMap(Map<String, dynamic> json) {
  final map = <String, List<ModelInfo>>{};
  for (final entry in json.entries) {
    if (entry.value is List) {
      map[entry.key] = (entry.value as List)
          .map((e) => ModelInfo.fromJson(e as Map<String, dynamic>))
          .toList();
    }
  }
  return map;
}
