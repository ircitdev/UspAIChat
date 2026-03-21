import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/datasources/remote/file_api.dart';
import '../../../data/models/message_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/chat_provider.dart';
import '../../../providers/conversation_provider.dart';

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

  @override
  void dispose() {
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    _focusNode.dispose();
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

  Future<void> _send() async {
    final text = _inputCtrl.text.trim();
    if (text.isEmpty) return;

    final convState = ref.read(conversationProvider);
    final conv = convState.active;
    if (conv == null) return;

    _inputCtrl.clear();
    final files = _attachedFiles.toList();
    setState(() => _attachedFiles = []);

    List<Map<String, dynamic>>? fileData;
    if (files.isNotEmpty) {
      final fileApi = FileApi(ref.read(apiClientProvider));
      final attachments = await fileApi.uploadFiles(files, conv.id);
      fileData = attachments.map((a) => a.toJson()).toList();
    }

    await ref.read(chatProvider.notifier).sendMessage(
      conversationId: conv.id,
      message: text,
      provider: conv.provider,
      model: conv.model,
      systemPrompt: conv.systemPrompt,
      files: fileData,
    );
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

  @override
  Widget build(BuildContext context) {
    final convState = ref.watch(conversationProvider);
    final chatState = ref.watch(chatProvider);
    final messages = convState.messages;

    if (chatState.streaming) _scrollToBottom();

    return Column(
      children: [
        // Model bar
        _ModelBar(conv: convState.active),

        // Messages
        Expanded(
          child: convState.loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.violet600))
            : ListView.builder(
                controller: _scrollCtrl,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                itemCount: messages.length + (chatState.streaming ? 1 : 0),
                itemBuilder: (_, i) {
                  if (i < messages.length) {
                    return _MessageBubble(message: messages[i]);
                  }
                  return _StreamingBubble(content: chatState.streamingContent);
                },
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
                            title: const Text('Photo'),
                            onTap: () { Navigator.pop(context); _pickImage(); },
                          ),
                          ListTile(
                            leading: const Icon(Icons.insert_drive_file),
                            title: const Text('File'),
                            onTap: () { Navigator.pop(context); _pickFile(); },
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: TextField(
                    controller: _inputCtrl,
                    focusNode: _focusNode,
                    maxLines: 4,
                    minLines: 1,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                    decoration: const InputDecoration(
                      hintText: 'Type a message...',
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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

class _ModelBar extends ConsumerWidget {
  final dynamic conv;
  const _ModelBar({this.conv});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (conv == null) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.cardBorder)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.providerColor(conv.provider).withOpacity(0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(conv.provider.toUpperCase(),
              style: TextStyle(color: AppColors.providerColor(conv.provider), fontSize: 11, fontWeight: FontWeight.w600),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(conv.model,
              style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          IconButton(
            icon: Icon(Icons.tune, size: 18,
              color: conv.systemPrompt.isNotEmpty ? AppColors.violet400 : AppColors.textDim),
            onPressed: () => context.go('/system-prompt'),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Message message;
  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;
    return Align(
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
        child: isUser
          ? Text(message.content, style: const TextStyle(color: Colors.white, fontSize: 14))
          : MarkdownBody(
              data: message.content,
              styleSheet: MarkdownStyleSheet(
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
                tableHead: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold),
                tableBorder: TableBorder.all(color: AppColors.cardBorder),
              ),
              selectable: true,
              onTapLink: (_, href, __) {
                if (href != null) Clipboard.setData(ClipboardData(text: href));
              },
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
              const Text('Thinking...', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
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
