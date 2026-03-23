import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:flutter_tts/flutter_tts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/datasources/remote/file_api.dart';
import '../../../data/datasources/remote/model_api.dart';
import '../../../data/models/message_model.dart';
import '../../../data/models/prompt_template_model.dart';
import '../../../data/models/sse_event_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/chat_provider.dart';
import '../../../providers/conversation_provider.dart';
import '../../../providers/prompt_template_provider.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _inputCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _focusNode = FocusNode();
  List<File> _attachedFiles = [];

  // Voice
  final stt.SpeechToText _speech = stt.SpeechToText();
  final FlutterTts _tts = FlutterTts();
  bool _isListening = false;
  bool _autoSpeak = false;
  bool _speechAvailable = false;
  bool _showScrollBtn = false;

  // Prompt templates
  bool _showTemplates = false;

  @override
  void initState() {
    super.initState();
    _initSpeech();
    _initTts();
    _scrollCtrl.addListener(_onScroll);
    // Load templates
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(promptTemplateProvider.notifier).loadTemplates();
    });
  }

  Future<void> _initSpeech() async {
    _speechAvailable = await _speech.initialize();
    setState(() {});
  }

  void _initTts() {
    _tts.setLanguage('ru-RU');
    _tts.setSpeechRate(0.5);
  }

  void _onScroll() {
    if (!_scrollCtrl.hasClients) return;
    final dist = _scrollCtrl.position.maxScrollExtent - _scrollCtrl.position.pixels;
    final show = dist > 200;
    if (show != _showScrollBtn) setState(() => _showScrollBtn = show);
  }

  @override
  void dispose() {
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    _focusNode.dispose();
    _speech.stop();
    _tts.stop();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _toggleListening() async {
    if (!_speechAvailable) return;
    if (_isListening) {
      await _speech.stop();
      setState(() => _isListening = false);
    } else {
      setState(() => _isListening = true);
      await _speech.listen(
        onResult: (result) {
          if (result.finalResult) {
            _inputCtrl.text = _inputCtrl.text.isEmpty
                ? result.recognizedWords
                : '${_inputCtrl.text} ${result.recognizedWords}';
            _inputCtrl.selection = TextSelection.fromPosition(
              TextPosition(offset: _inputCtrl.text.length),
            );
          }
        },
        localeId: 'ru_RU',
      );
    }
  }

  Future<void> _speak(String text) async {
    final clean = text
        .replaceAll(RegExp(r'```[\s\S]*?```'), ' блок кода ')
        .replaceAll(RegExp(r'`[^`]+`'), '')
        .replaceAll(RegExp(r'[#*_~>|]'), '')
        .replaceAll(RegExp(r'\n+'), '. ');
    await _tts.speak(clean);
  }

  Future<void> _send() async {
    final text = _inputCtrl.text.trim();
    if (text.isEmpty) return;

    final convState = ref.read(conversationProvider);
    final conv = convState.active;
    if (conv == null) return;

    // Save files before clearing state
    final filesToUpload = List<File>.from(_attachedFiles);

    _inputCtrl.clear();
    setState(() {
      _showTemplates = false;
      _attachedFiles = [];
    });

    List<Map<String, dynamic>>? fileData;
    if (filesToUpload.isNotEmpty) {
      final fileApi = FileApi(ref.read(apiClientProvider));
      final attachments = await fileApi.uploadFiles(filesToUpload, conv.id);
      fileData = attachments.map((a) => a.toJson()).toList();
    }

    final prevLen = ref.read(conversationProvider).messages.length;

    await ref.read(chatProvider.notifier).sendMessage(
      conversationId: conv.id,
      message: text,
      provider: conv.provider,
      model: conv.model,
      systemPrompt: conv.systemPrompt,
      files: fileData,
    );

    // Auto-speak last assistant message
    if (_autoSpeak) {
      final msgs = ref.read(conversationProvider).messages;
      if (msgs.length > prevLen) {
        final last = msgs.last;
        if (last.isAssistant) _speak(last.content);
      }
    }
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery);
    if (image != null) setState(() => _attachedFiles.add(File(image.path)));
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(allowMultiple: true);
    if (result != null) {
      setState(() => _attachedFiles.addAll(result.files.map((f) => File(f.path!))));
    }
  }

  void _onTextChanged(String value) {
    if (value == '/' || (value.startsWith('/') && !value.contains(' ') && value.length < 30)) {
      setState(() => _showTemplates = true);
    } else {
      if (_showTemplates) setState(() => _showTemplates = false);
    }
  }

  void _insertTemplate(PromptTemplate tpl) {
    _inputCtrl.text = tpl.content;
    _inputCtrl.selection = TextSelection.fromPosition(TextPosition(offset: tpl.content.length));
    setState(() => _showTemplates = false);
    _focusNode.requestFocus();
  }

  String _formatDateGroup(int timestamp) {
    final date = DateTime.fromMillisecondsSinceEpoch(timestamp * 1000);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final msgDay = DateTime(date.year, date.month, date.day);
    if (msgDay == today) return 'Сегодня';
    if (msgDay == today.subtract(const Duration(days: 1))) return 'Вчера';
    return DateFormat('d MMMM yyyy', 'ru').format(date);
  }

  @override
  Widget build(BuildContext context) {
    final convState = ref.watch(conversationProvider);
    final chatState = ref.watch(chatProvider);
    final messages = convState.messages;
    final templates = ref.watch(promptTemplateProvider);

    if (chatState.streaming) _scrollToBottom();

    // Group messages by date
    final groups = <String, List<Message>>{};
    for (final msg in messages) {
      final key = _formatDateGroup(msg.createdAt);
      groups.putIfAbsent(key, () => []).add(msg);
    }

    return Column(
      children: [
        _ModelBar(conv: convState.active),

        // Messages
        Expanded(
          child: Stack(
            children: [
              convState.loading
                ? _MessageSkeleton()
                : AnimatedSwitcher(
                    duration: const Duration(milliseconds: 200),
                    child: ListView(
                      key: ValueKey(convState.activeId),
                      controller: _scrollCtrl,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      children: [
                        for (final entry in groups.entries) ...[
                          // Date separator
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Row(children: [
                              const Expanded(child: Divider(color: AppColors.cardBorder)),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                child: Text(entry.key, style: const TextStyle(color: AppColors.textDim, fontSize: 11)),
                              ),
                              const Expanded(child: Divider(color: AppColors.cardBorder)),
                            ]),
                          ),
                          ...entry.value.map((msg) => _MessageBubble(
                            message: msg,
                            onDelete: () => ref.read(conversationProvider.notifier).deleteMessage(msg.conversationId, msg.id),
                            onSpeak: msg.isAssistant ? () => _speak(msg.content) : null,
                          )),
                        ],
                        if (chatState.streaming) ...[
                          if (chatState.routingInfo != null)
                            _RoutingBadge(info: chatState.routingInfo!),
                          _StreamingBubble(content: chatState.streamingContent),
                        ],
                      ],
                    ),
                  ),

              // Scroll to bottom + auto-speak
              Positioned(
                right: 12,
                bottom: 12,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_speechAvailable)
                      FloatingActionButton.small(
                        heroTag: 'tts',
                        onPressed: () => setState(() {
                          _autoSpeak = !_autoSpeak;
                          if (!_autoSpeak) _tts.stop();
                        }),
                        backgroundColor: _autoSpeak ? AppColors.violet600 : AppColors.surfaceLight,
                        child: Icon(
                          _autoSpeak ? Icons.volume_up : Icons.volume_off,
                          size: 18,
                          color: _autoSpeak ? Colors.white : AppColors.textMuted,
                        ),
                      ),
                    if (_showScrollBtn) ...[
                      const SizedBox(height: 8),
                      FloatingActionButton.small(
                        heroTag: 'scroll',
                        onPressed: _scrollToBottom,
                        backgroundColor: AppColors.surfaceLight,
                        child: const Icon(Icons.keyboard_arrow_down, color: AppColors.textMuted),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),

        // Error
        if (chatState.error != null)
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 12),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.error.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(chatState.error!, style: const TextStyle(color: AppColors.error, fontSize: 12)),
          ),

        // Prompt templates popup
        if (_showTemplates && templates.isNotEmpty)
          Container(
            constraints: const BoxConstraints(maxHeight: 200),
            margin: const EdgeInsets.symmetric(horizontal: 8),
            decoration: BoxDecoration(
              color: AppColors.surface,
              border: Border.all(color: AppColors.cardBorder),
              borderRadius: BorderRadius.circular(12),
            ),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: templates.length,
              itemBuilder: (_, i) {
                final tpl = templates[i];
                final filter = _inputCtrl.text.length > 1 ? _inputCtrl.text.substring(1).toLowerCase() : '';
                if (filter.isNotEmpty && !tpl.name.toLowerCase().contains(filter)) return const SizedBox.shrink();
                return ListTile(
                  dense: true,
                  title: Text(tpl.name, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                  subtitle: Text(tpl.content, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, color: AppColors.textDim)),
                  trailing: Chip(
                    label: Text(tpl.category, style: const TextStyle(fontSize: 9)),
                    padding: EdgeInsets.zero,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    backgroundColor: AppColors.surfaceLight,
                    side: const BorderSide(color: AppColors.cardBorder),
                  ),
                  onTap: () => _insertTemplate(tpl),
                );
              },
            ),
          ),

        // Attached files
        if (_attachedFiles.isNotEmpty)
          SizedBox(
            height: 60,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: _attachedFiles.asMap().entries.map((e) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Chip(
                  label: Text(e.value.path.split('/').last, style: const TextStyle(fontSize: 11)),
                  deleteIcon: const Icon(Icons.close, size: 14),
                  onDeleted: () => setState(() => _attachedFiles.removeAt(e.key)),
                  backgroundColor: AppColors.surfaceLight,
                  side: const BorderSide(color: AppColors.cardBorder),
                ),
              )).toList(),
            ),
          ),

        // Input
        Container(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
          decoration: const BoxDecoration(
            color: AppColors.surface,
            border: Border(top: BorderSide(color: AppColors.cardBorder)),
          ),
          child: SafeArea(
            top: false,
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.attach_file, size: 20, color: AppColors.textMuted),
                  onPressed: () => showModalBottomSheet(
                    context: context,
                    builder: (_) => SafeArea(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          ListTile(
                            leading: const Icon(Icons.image),
                            title: const Text('Фото'),
                            onTap: () { Navigator.pop(context); _pickImage(); },
                          ),
                          ListTile(
                            leading: const Icon(Icons.insert_drive_file),
                            title: const Text('Файл'),
                            onTap: () { Navigator.pop(context); _pickFile(); },
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                // Mic button
                if (_speechAvailable)
                  IconButton(
                    icon: Icon(
                      _isListening ? Icons.mic_off : Icons.mic,
                      size: 20,
                      color: _isListening ? AppColors.error : AppColors.textMuted,
                    ),
                    onPressed: _toggleListening,
                  ),
                Expanded(
                  child: TextField(
                    controller: _inputCtrl,
                    focusNode: _focusNode,
                    maxLines: 4,
                    minLines: 1,
                    onChanged: _onTextChanged,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: _isListening ? 'Говорите...' : 'Введите сообщение... (/ для шаблонов)',
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _send(),
                  ),
                ),
                IconButton(
                  icon: chatState.streaming
                    ? const Icon(Icons.stop_circle, size: 24, color: AppColors.error)
                    : const Icon(Icons.send, size: 22, color: AppColors.violet600),
                  onPressed: chatState.streaming
                    ? () => ref.read(chatProvider.notifier).cancelStream()
                    : _send,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// Skeleton loading
class _MessageSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: List.generate(3, (i) => Align(
          alignment: i.isEven ? Alignment.centerLeft : Alignment.centerRight,
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            width: MediaQuery.of(context).size.width * (i.isEven ? 0.7 : 0.5),
            height: 60 + (i * 10),
            decoration: BoxDecoration(
              color: AppColors.surfaceLight.withOpacity(0.5),
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        )),
      ),
    );
  }
}

class _ModelBar extends ConsumerStatefulWidget {
  final dynamic conv;
  const _ModelBar({this.conv});

  @override
  ConsumerState<_ModelBar> createState() => _ModelBarState();
}

class _ModelBarState extends ConsumerState<_ModelBar> {
  Map<String, List<dynamic>>? _models;
  Map<String, List<Map<String, dynamic>>>? _pricing;

  Future<void> _loadModels() async {
    if (_models != null) return;
    final api = ModelApi(ref.read(apiClientProvider));
    final models = await api.getModels();
    try { _pricing = await api.getPricing(); } catch (_) {}
    setState(() => _models = models);
  }

  double? _getPrice(String provider, String modelId) {
    if (_pricing == null || provider == 'auto') return null;
    final models = _pricing![provider];
    if (models == null) return null;
    for (final m in models) {
      if (m['id'] == modelId) return (m['pricePer1k'] as num).toDouble();
    }
    return null;
  }

  static const _providerLabels = {
    'auto': 'Авто (Smart Router)',
    'anthropic': 'Anthropic',
    'openai': 'OpenAI',
    'gemini': 'Google',
    'deepseek': 'DeepSeek',
    'kimi': 'Kimi',
  };

  void _showProviderPicker() async {
    await _loadModels();
    if (_models == null || !mounted) return;
    final providers = _models!.keys.toList();
    final conv = widget.conv;

    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Выберите провайдера', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ),
            ...providers.map((p) => ListTile(
              leading: p == 'auto'
                ? const Icon(Icons.auto_awesome, size: 16, color: AppColors.violet400)
                : Container(
                    width: 8, height: 8,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.providerColor(p)),
                  ),
              title: Text(_providerLabels[p] ?? p.toUpperCase(), style: TextStyle(
                color: p == 'auto' ? AppColors.violet400 : AppColors.providerColor(p),
                fontWeight: FontWeight.w600, fontSize: 14,
              )),
              subtitle: p == 'auto' ? const Text('Автоматический выбор модели', style: TextStyle(fontSize: 11, color: AppColors.textDim)) : null,
              trailing: p == conv.provider ? const Icon(Icons.check, size: 16, color: AppColors.violet400) : null,
              onTap: () {
                Navigator.pop(ctx);
                if (p == 'auto') {
                  ref.read(conversationProvider.notifier).updateConversation(
                    conv.id, {'provider': 'auto', 'model': 'auto'},
                  );
                } else {
                  final models = _models![p]!;
                  if (models.isNotEmpty) {
                    ref.read(conversationProvider.notifier).updateConversation(
                      conv.id, {'provider': p, 'model': models.first.id},
                    );
                  }
                }
              },
            )),
          ],
        ),
      ),
    );
  }

  void _showModelPicker() async {
    await _loadModels();
    if (_models == null || !mounted) return;
    final conv = widget.conv;
    final models = _models![conv.provider] ?? [];

    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text('Модели ${conv.provider.toUpperCase()}',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ),
            ...models.map((m) {
              final price = _getPrice(conv.provider, m.id);
              return ListTile(
                dense: true,
                title: Row(
                  children: [
                    Expanded(child: Text(m.name, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13))),
                    if (price != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: price <= 0.5 ? Colors.green.withOpacity(0.15) : price <= 3 ? Colors.amber.withOpacity(0.15) : price <= 10 ? Colors.orange.withOpacity(0.15) : Colors.red.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text('$price кр/1K',
                          style: TextStyle(fontSize: 10, fontFamily: 'monospace', color: price <= 0.5 ? Colors.green : price <= 3 ? Colors.amber : price <= 10 ? Colors.orange : Colors.red)),
                      ),
                  ],
                ),
                subtitle: Text('Контекст: ${_formatContext(m.context)}', style: const TextStyle(color: AppColors.textDim, fontSize: 11)),
                trailing: m.id == conv.model ? const Icon(Icons.check, size: 16, color: AppColors.violet400) : null,
                onTap: () {
                  ref.read(conversationProvider.notifier).updateConversation(conv.id, {'model': m.id});
                  Navigator.pop(ctx);
                },
              );
            }),
            if (models.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Нет доступных моделей', style: TextStyle(color: AppColors.textDim)),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final conv = widget.conv;
    if (conv == null) return const SizedBox.shrink();
    final isAuto = conv.provider == 'auto';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.cardBorder)),
      ),
      child: Row(
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: _showProviderPicker,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isAuto ? AppColors.violet600.withOpacity(0.15) : AppColors.providerColor(conv.provider).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  if (isAuto) ...[
                    const Icon(Icons.auto_awesome, size: 12, color: AppColors.violet400),
                    const SizedBox(width: 4),
                    const Text('АВТО',
                      style: TextStyle(color: AppColors.violet400, fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ] else ...[
                    Text(conv.provider.toUpperCase(),
                      style: TextStyle(color: AppColors.providerColor(conv.provider), fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ],
                  const SizedBox(width: 4),
                  Icon(Icons.unfold_more, size: 12, color: isAuto ? AppColors.violet400 : AppColors.providerColor(conv.provider)),
                ]),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: isAuto
              ? const Text('Smart Router', style: TextStyle(color: AppColors.textMuted, fontSize: 12))
              : Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: _showModelPicker,
                    child: Row(children: [
                      Flexible(
                        child: Text(conv.model,
                          style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.unfold_more, size: 12, color: AppColors.textDim),
                    ]),
                  ),
                ),
          ),
          IconButton(
            icon: Icon(Icons.tune, size: 18,
              color: conv.systemPrompt.isNotEmpty ? AppColors.violet400 : AppColors.textDim),
            onPressed: () => context.go('/system-prompt'),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
          ),
        ],
      ),
    );
  }
}

String _formatContext(dynamic ctx) {
  if (ctx == null) return '';
  final n = ctx is num ? ctx.toInt() : int.tryParse(ctx.toString()) ?? 0;
  if (n >= 1000000) {
    final m = n / 1000000;
    return m == m.roundToDouble() ? '${m.round()}M' : '${m.toStringAsFixed(1)}M';
  } else if (n >= 1000) {
    final k = n / 1000;
    return k == k.roundToDouble() ? '${k.round()}K' : '${k.toStringAsFixed(1)}K';
  }
  return n.toString();
}

class _MarkdownContent extends StatelessWidget {
  final String content;
  const _MarkdownContent({required this.content});

  static final _tableRegex = RegExp(r'(\n|^)(\|.+\|[ \t]*\n\|[-| :]+\|[ \t]*\n(\|.+\|[ \t]*\n?)+)', multiLine: true);

  static MarkdownStyleSheet _baseStyle() => MarkdownStyleSheet(
    p: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
    code: TextStyle(
      color: AppColors.textPrimary,
      backgroundColor: AppColors.background,
      fontSize: 13,
      fontFamily: 'monospace',
    ),
    codeblockDecoration: BoxDecoration(
      color: AppColors.background,
      borderRadius: BorderRadius.circular(8),
    ),
    tableHead: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
    tableBody: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
    tableBorder: TableBorder.all(color: AppColors.cardBorder),
    tableColumnWidth: const IntrinsicColumnWidth(),
    tableCellsPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
  );

  @override
  Widget build(BuildContext context) {
    // Split content into segments: regular markdown and table blocks
    final matches = _tableRegex.allMatches(content).toList();
    if (matches.isEmpty) {
      return MarkdownBody(
        data: content,
        styleSheet: _baseStyle(),
        selectable: true,
        onTapLink: (_, href, __) {
          if (href != null) Clipboard.setData(ClipboardData(text: href));
        },
      );
    }

    // Build segments: text, scrollable table, text, scrollable table, ...
    final segments = <Widget>[];
    int lastEnd = 0;

    for (final match in matches) {
      // Text before the table
      if (match.start > lastEnd) {
        final before = content.substring(lastEnd, match.start).trim();
        if (before.isNotEmpty) {
          segments.add(MarkdownBody(
            data: before,
            styleSheet: _baseStyle(),
            selectable: true,
            onTapLink: (_, href, __) {
              if (href != null) Clipboard.setData(ClipboardData(text: href));
            },
          ));
        }
      }

      // Table in horizontal scroll
      final tableText = match.group(0)!.trim();
      segments.add(SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: MarkdownBody(
          data: tableText,
          styleSheet: _baseStyle(),
          selectable: true,
          fitContent: true,
        ),
      ));

      lastEnd = match.end;
    }

    // Remaining text after last table
    if (lastEnd < content.length) {
      final after = content.substring(lastEnd).trim();
      if (after.isNotEmpty) {
        segments.add(MarkdownBody(
          data: after,
          styleSheet: _baseStyle(),
          selectable: true,
          onTapLink: (_, href, __) {
            if (href != null) Clipboard.setData(ClipboardData(text: href));
          },
        ));
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: segments,
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Message message;
  final VoidCallback onDelete;
  final VoidCallback? onSpeak;

  const _MessageBubble({required this.message, required this.onDelete, this.onSpeak});

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;
    return GestureDetector(
      onLongPress: () {
        showModalBottomSheet(
          context: context,
          builder: (_) => SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(Icons.copy),
                  title: const Text('Копировать'),
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: message.content));
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Скопировано'), duration: Duration(seconds: 1)),
                    );
                  },
                ),
                if (onSpeak != null)
                  ListTile(
                    leading: const Icon(Icons.volume_up),
                    title: const Text('Озвучить'),
                    onTap: () { Navigator.pop(context); onSpeak!(); },
                  ),
                ListTile(
                  leading: const Icon(Icons.delete, color: AppColors.error),
                  title: const Text('Удалить', style: TextStyle(color: AppColors.error)),
                  onTap: () {
                    Navigator.pop(context);
                    onDelete();
                  },
                ),
              ],
            ),
          ),
        );
      },
      child: Align(
        alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          margin: EdgeInsets.only(
            top: 4, bottom: 4,
            left: isUser ? 48 : 0,
            right: isUser ? 0 : 48,
          ),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isUser ? AppColors.violet600 : AppColors.surfaceLight,
            borderRadius: BorderRadius.circular(16).copyWith(
              bottomRight: isUser ? const Radius.circular(4) : null,
              bottomLeft: !isUser ? const Radius.circular(4) : null,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              isUser
                ? Text(message.content, style: const TextStyle(color: Colors.white, fontSize: 14))
                : _MarkdownContent(content: message.content),
              // Timestamp + model
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      DateFormat('HH:mm').format(DateTime.fromMillisecondsSinceEpoch(message.createdAt * 1000)),
                      style: TextStyle(fontSize: 10, color: isUser ? Colors.white54 : AppColors.textDim),
                    ),
                    if (message.model != null) ...[
                      const SizedBox(width: 6),
                      Text(message.model!, style: TextStyle(fontSize: 10, color: isUser ? Colors.white38 : AppColors.textDim)),
                    ],
                    if (!isUser && message.cost != null && message.cost! > 0) ...[
                      const SizedBox(width: 6),
                      Text(
                        '−${message.cost! < 0.01 ? message.cost!.toStringAsFixed(4) : message.cost!.toStringAsFixed(2)} кр',
                        style: const TextStyle(fontSize: 9, color: Colors.amber, fontFamily: 'monospace'),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StreamingBubble extends StatelessWidget {
  final String content;
  const _StreamingBubble({required this.content});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(top: 4, bottom: 4, right: 48),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(16).copyWith(bottomLeft: const Radius.circular(4)),
        ),
        child: content.isEmpty
          ? Row(mainAxisSize: MainAxisSize.min, children: [
              SizedBox(width: 14, height: 14,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.violet400)),
              const SizedBox(width: 8),
              const Text('Думаю...', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
            ])
          : MarkdownBody(
              data: '$content\u258C',
              styleSheet: MarkdownStyleSheet(
                p: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
              ),
            ),
      ),
    );
  }
}

class _RoutingBadge extends StatelessWidget {
  final SseRoutingInfo info;
  const _RoutingBadge({required this.info});

  static const _tierColors = {
    'SIMPLE': Color(0xFF4ADE80),
    'MEDIUM': Color(0xFFFBBF24),
    'COMPLEX': Color(0xFFFB923C),
  };

  static const _tierLabels = {
    'SIMPLE': 'Простой',
    'MEDIUM': 'Средний',
    'COMPLEX': 'Сложный',
  };

  void _showDetails(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.auto_awesome, color: AppColors.violet400, size: 20),
                  const SizedBox(width: 8),
                  const Text('Smart Router', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                  const Spacer(),
                  IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => Navigator.pop(ctx)),
                ],
              ),
              const SizedBox(height: 16),

              // Model
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.cardBorder),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 8, height: 8,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.providerColor(info.selectedProvider),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(info.selectedProvider.toUpperCase(),
                      style: TextStyle(color: AppColors.providerColor(info.selectedProvider), fontWeight: FontWeight.w600, fontSize: 13)),
                    const SizedBox(width: 8),
                    Expanded(child: Text(info.selectedModel, style: const TextStyle(color: AppColors.textMuted, fontSize: 13))),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Tier
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: (_tierColors[info.tier] ?? AppColors.warning).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: (_tierColors[info.tier] ?? AppColors.warning).withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    Text(_tierLabels[info.tier] ?? info.tier,
                      style: TextStyle(color: _tierColors[info.tier] ?? AppColors.warning, fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(width: 8),
                    Text('(${info.tier})', style: const TextStyle(color: AppColors.textDim, fontSize: 12)),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Reasoning
              const Text('Обоснование', style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w600, fontSize: 12)),
              const SizedBox(height: 4),
              Text(info.reasoning, style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
              const SizedBox(height: 16),

              // Cost per 1K
              if (info.costPer1k > 0) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.cardBorder),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.paid, size: 16, color: AppColors.warning),
                      const SizedBox(width: 8),
                      Text('${info.costPer1k} кр/1K токенов',
                        style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w500)),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // Stats row
              Row(
                children: [
                  _StatChip('Уверенность', '${(info.confidence * 100).round()}%', AppColors.violet400),
                  const SizedBox(width: 8),
                  if (info.savings > 0) _StatChip('Экономия', '-${info.savings}%', AppColors.success),
                  const SizedBox(width: 8),
                  _StatChip('Сложность', '${info.score}', AppColors.textMuted),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final color = _tierColors[info.tier] ?? AppColors.warning;
    return Align(
      alignment: Alignment.centerLeft,
      child: GestureDetector(
        onTap: () => _showDetails(context),
        child: Container(
          margin: const EdgeInsets.only(left: 0, bottom: 4),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.auto_awesome, size: 10, color: AppColors.violet400),
              const SizedBox(width: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: color.withOpacity(0.3)),
                ),
                child: Text(info.tier, style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 6),
              Text(info.selectedModel, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
              if (info.costPer1k > 0) ...[
                const SizedBox(width: 4),
                Text('${info.costPer1k} кр/1K', style: const TextStyle(color: AppColors.textDim, fontSize: 9)),
              ],
              if (info.savings > 0) ...[
                const SizedBox(width: 4),
                Text('-${info.savings}%', style: const TextStyle(color: AppColors.success, fontSize: 10, fontWeight: FontWeight.w600)),
              ],
              const SizedBox(width: 4),
              const Text('подробнее', style: TextStyle(color: AppColors.textDim, fontSize: 9)),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatChip(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 16)),
            Text(label, style: const TextStyle(color: AppColors.textDim, fontSize: 10)),
          ],
        ),
      ),
    );
  }
}
