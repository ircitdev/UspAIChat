import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/prompt_template_provider.dart';
import '../../../data/models/prompt_template_model.dart';

class PromptTemplatesScreen extends ConsumerStatefulWidget {
  const PromptTemplatesScreen({super.key});

  @override
  ConsumerState<PromptTemplatesScreen> createState() => _PromptTemplatesScreenState();
}

class _PromptTemplatesScreenState extends ConsumerState<PromptTemplatesScreen> {
  final _nameCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  String _category = 'general';
  String? _editingId;

  static const _categories = ['general', 'coding', 'writing', 'analysis', 'translation', 'creative'];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(promptTemplateProvider.notifier).loadTemplates();
    });
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _contentCtrl.dispose();
    super.dispose();
  }

  void _resetForm() {
    _nameCtrl.clear();
    _contentCtrl.clear();
    _category = 'general';
    _editingId = null;
  }

  void _editTemplate(PromptTemplate tpl) {
    _nameCtrl.text = tpl.name;
    _contentCtrl.text = tpl.content;
    _category = tpl.category;
    _editingId = tpl.id;
    _showForm();
  }

  void _showForm() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheetState) => Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(ctx).viewInsets.bottom + 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(_editingId != null ? 'Edit template' : 'New template',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextField(
              controller: _nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Name', isDense: true,
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _contentCtrl,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Prompt content', isDense: true,
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _category,
              decoration: const InputDecoration(labelText: 'Category', isDense: true, border: OutlineInputBorder()),
              items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
              onChanged: (v) => setSheetState(() => _category = v!),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () { _resetForm(); Navigator.pop(ctx); },
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () async {
                      if (_nameCtrl.text.trim().isEmpty || _contentCtrl.text.trim().isEmpty) return;
                      final notifier = ref.read(promptTemplateProvider.notifier);
                      if (_editingId != null) {
                        await notifier.updateTemplate(_editingId!, {
                          'name': _nameCtrl.text.trim(),
                          'content': _contentCtrl.text.trim(),
                          'category': _category,
                        });
                      } else {
                        await notifier.createTemplate(
                          name: _nameCtrl.text.trim(),
                          content: _contentCtrl.text.trim(),
                          category: _category,
                        );
                      }
                      _resetForm();
                      if (ctx.mounted) Navigator.pop(ctx);
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.violet600),
                    child: Text(_editingId != null ? 'Save' : 'Create'),
                  ),
                ),
              ],
            ),
          ],
        ),
      )),
    );
  }

  @override
  Widget build(BuildContext context) {
    final templates = ref.watch(promptTemplateProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Prompt Templates'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () { _resetForm(); _showForm(); },
          ),
        ],
      ),
      body: templates.isEmpty
        ? const Center(child: Text('No templates yet.\nTap + to create one.',
            textAlign: TextAlign.center, style: TextStyle(color: AppColors.textDim)))
        : ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: templates.length,
            itemBuilder: (_, i) {
              final tpl = templates[i];
              return Card(
                color: AppColors.surface,
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Row(
                    children: [
                      Expanded(child: Text(tpl.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
                      Chip(
                        label: Text(tpl.category, style: const TextStyle(fontSize: 10)),
                        padding: EdgeInsets.zero,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        backgroundColor: AppColors.surfaceLight,
                        side: const BorderSide(color: AppColors.cardBorder),
                      ),
                    ],
                  ),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(tpl.content, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: AppColors.textDim)),
                  ),
                  trailing: PopupMenuButton<String>(
                    onSelected: (action) {
                      if (action == 'edit') _editTemplate(tpl);
                      if (action == 'delete') ref.read(promptTemplateProvider.notifier).deleteTemplate(tpl.id);
                    },
                    itemBuilder: (_) => [
                      const PopupMenuItem(value: 'edit', child: Text('Edit')),
                      const PopupMenuItem(value: 'delete', child: Text('Delete', style: TextStyle(color: AppColors.error))),
                    ],
                  ),
                ),
              );
            },
          ),
    );
  }
}
