import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/datasources/remote/prompt_template_api.dart';
import '../data/models/prompt_template_model.dart';
import 'auth_provider.dart';

final promptTemplateApiProvider = Provider<PromptTemplateApi>(
  (ref) => PromptTemplateApi(ref.read(apiClientProvider)),
);

class PromptTemplateNotifier extends StateNotifier<List<PromptTemplate>> {
  final PromptTemplateApi _api;
  PromptTemplateNotifier(this._api) : super([]);

  Future<void> loadTemplates() async {
    try {
      state = await _api.getTemplates();
    } catch (_) {}
  }

  Future<void> createTemplate({required String name, required String content, String category = 'general'}) async {
    final tpl = await _api.createTemplate(name: name, content: content, category: category);
    state = [...state, tpl];
  }

  Future<void> updateTemplate(String id, Map<String, dynamic> data) async {
    await _api.updateTemplate(id, data);
    await loadTemplates();
  }

  Future<void> deleteTemplate(String id) async {
    await _api.deleteTemplate(id);
    state = state.where((t) => t.id != id).toList();
  }
}

final promptTemplateProvider = StateNotifierProvider<PromptTemplateNotifier, List<PromptTemplate>>(
  (ref) => PromptTemplateNotifier(ref.read(promptTemplateApiProvider)),
);
