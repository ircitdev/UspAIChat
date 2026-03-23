import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/conversation_provider.dart';

const _presets = {
  'Senior Developer': 'You are a senior software developer. Write clean, efficient, well-documented code. Explain your decisions.',
  'Technical Writer': 'You are a technical writer. Create clear, structured documentation with examples.',
  'Product Manager': 'You are a product manager. Analyze requirements, prioritize features, and suggest roadmaps.',
  'Researcher': 'You are a research assistant. Analyze information, cite sources, and provide balanced perspectives.',
  'Translator RU/EN': 'You are a professional translator between Russian and English. Preserve meaning, tone, and style.',
};

class SystemPromptScreen extends ConsumerStatefulWidget {
  const SystemPromptScreen({super.key});

  @override
  ConsumerState<SystemPromptScreen> createState() => _SystemPromptScreenState();
}

class _SystemPromptScreenState extends ConsumerState<SystemPromptScreen> {
  final _ctrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    final conv = ref.read(conversationProvider).active;
    _ctrl.text = conv?.systemPrompt ?? '';
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final conv = ref.read(conversationProvider).active;
    if (conv == null) return;
    await ref.read(conversationProvider.notifier).updateConversation(conv.id, {'system_prompt': _ctrl.text});
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Системный промпт', style: TextStyle(fontSize: 16)),
        actions: [
          TextButton(onPressed: _save, child: const Text('Сохранить')),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Presets
          const Text('Пресеты', style: TextStyle(color: AppColors.textMuted, fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8, runSpacing: 8,
            children: _presets.entries.map((e) => ActionChip(
              label: Text(e.key, style: const TextStyle(fontSize: 12, color: AppColors.textPrimary)),
              backgroundColor: AppColors.surfaceLight,
              side: const BorderSide(color: AppColors.violet600, width: 0.5),
              elevation: 0,
              pressElevation: 2,
              onPressed: () => setState(() => _ctrl.text = e.value),
            )).toList(),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _ctrl,
            maxLines: 10,
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
            decoration: InputDecoration(
              hintText: 'Введите системный промпт...',
              hintStyle: const TextStyle(color: AppColors.textDim),
              alignLabelWithHint: true,
              filled: true,
              fillColor: AppColors.surfaceLight,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.cardBorder),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.cardBorder),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.violet600),
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (_ctrl.text.isNotEmpty)
            TextButton(
              onPressed: () => setState(() => _ctrl.clear()),
              child: const Text('Очистить', style: TextStyle(color: AppColors.error)),
            ),
        ],
      ),
    );
  }
}
