import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/datasources/remote/share_api.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/conversation_provider.dart';
import '../../../data/models/folder_model.dart';
import '../../../providers/folder_provider.dart';

class ConversationsList extends ConsumerStatefulWidget {
  const ConversationsList({super.key});

  @override
  ConsumerState<ConversationsList> createState() => _ConversationsListState();
}

class _ConversationsListState extends ConsumerState<ConversationsList> {
  final _folderNameCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(folderProvider.notifier).loadFolders();
    });
  }

  @override
  void dispose() {
    _folderNameCtrl.dispose();
    super.dispose();
  }

  Future<void> _showExportDialog(String convId, String title) async {
    final format = await showModalBottomSheet<String>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Экспортировать', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ),
            ListTile(
              leading: const Icon(Icons.description),
              title: const Text('Markdown'),
              onTap: () => Navigator.pop(context, 'md'),
            ),
            ListTile(
              leading: const Icon(Icons.code),
              title: const Text('JSON'),
              onTap: () => Navigator.pop(context, 'json'),
            ),
            ListTile(
              leading: const Icon(Icons.text_snippet),
              title: const Text('Text'),
              onTap: () => Navigator.pop(context, 'txt'),
            ),
          ],
        ),
      ),
    );
    if (format == null) return;

    try {
      final api = ref.read(conversationApiProvider);
      final content = await api.exportConversation(convId, format: format);
      // Share via system share sheet
      await Share.share(content, subject: '$title.$format');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Export error: $e')));
      }
    }
  }

  Future<void> _showShareDialog(String convId) async {
    final shareApi = ShareApi(ref.read(apiClientProvider));

    try {
      final status = await shareApi.getShareStatus(convId);
      if (!mounted) return;

      if (status['shared'] == true) {
        // Already shared — show link
        final shareId = status['share_id'];
        final url = 'https://app.aifuturenow.ru/shared/$shareId';
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Shared link'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SelectableText(url, style: const TextStyle(fontSize: 13)),
                const SizedBox(height: 8),
                Text('Views: ${status['views'] ?? 0}', style: const TextStyle(fontSize: 12, color: AppColors.textDim)),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: url));
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Link copied')));
                },
                child: const Text('Copy link'),
              ),
              TextButton(
                onPressed: () async {
                  await shareApi.unshareConversation(convId);
                  if (ctx.mounted) Navigator.pop(ctx);
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Share disabled')));
                },
                child: const Text('Disable', style: TextStyle(color: AppColors.error)),
              ),
            ],
          ),
        );
      } else {
        // Create new share
        final passwordCtrl = TextEditingController();
        bool usePassword = false;
        showDialog(
          context: context,
          builder: (ctx) => StatefulBuilder(builder: (ctx, setDialogState) => AlertDialog(
            title: const Text('Поделиться'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CheckboxListTile(
                  value: usePassword,
                  onChanged: (v) => setDialogState(() => usePassword = v!),
                  title: const Text('Protect with password', style: TextStyle(fontSize: 14)),
                  contentPadding: EdgeInsets.zero,
                ),
                if (usePassword)
                  TextField(
                    controller: passwordCtrl,
                    decoration: const InputDecoration(hintText: 'Password', isDense: true),
                  ),
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
              ElevatedButton(
                onPressed: () async {
                  final result = await shareApi.shareConversation(
                    convId,
                    password: usePassword ? passwordCtrl.text : null,
                  );
                  final url = 'https://app.aifuturenow.ru/shared/${result['share_id']}';
                  if (ctx.mounted) Navigator.pop(ctx);
                  Clipboard.setData(ClipboardData(text: url));
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Link copied!')));
                },
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.violet600),
                child: const Text('Create link'),
              ),
            ],
          )),
        );
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  void _showCreateFolder() {
    _folderNameCtrl.clear();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New folder'),
        content: TextField(
          controller: _folderNameCtrl,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Folder name'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              if (_folderNameCtrl.text.trim().isNotEmpty) {
                ref.read(folderProvider.notifier).createFolder(_folderNameCtrl.text.trim());
                Navigator.pop(ctx);
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.violet600),
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(conversationProvider);
    final user = ref.watch(authProvider).user;
    final notifier = ref.read(conversationProvider.notifier);
    final folders = ref.watch(folderProvider);
    final pinned = state.pinned;
    final allUnpinned = state.unpinned;

    // Group by folder
    final unfolderedUnpinned = allUnpinned.where((c) => c.folderId == null).toList();

    return SafeArea(
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 8, 8),
            child: Row(
              children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    gradient: const LinearGradient(colors: [AppColors.violet600, AppColors.purple800]),
                  ),
                  child: const Icon(Icons.smart_toy, color: Colors.white, size: 18),
                ),
                const SizedBox(width: 10),
                const Text('UspAIChat', style: TextStyle(
                  color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold,
                )),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.add, color: AppColors.textMuted, size: 20),
                  onPressed: () {
                    notifier.createConversation();
                    Navigator.of(context).pop();
                  },
                ),
              ],
            ),
          ),
          const Divider(color: AppColors.cardBorder, height: 1),

          // Conversations
          Expanded(
            child: RefreshIndicator(
              color: AppColors.violet600,
              onRefresh: () async {
                await notifier.loadConversations();
                await ref.read(folderProvider.notifier).loadFolders();
              },
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 4),
                children: [
                  // Pinned
                  if (pinned.isNotEmpty) ...[
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
                      child: Text('Pinned', style: TextStyle(color: AppColors.textDim, fontSize: 11, fontWeight: FontWeight.w600)),
                    ),
                    ...pinned.map((c) => _ConvTile(
                      conv: c, isActive: c.id == state.activeId,
                      onExport: () => _showExportDialog(c.id, c.title),
                      onShare: () => _showShareDialog(c.id),
                      folders: folders,
                    )),
                    const Divider(color: AppColors.cardBorder, height: 1, indent: 16, endIndent: 16),
                  ],

                  // Folders
                  ...folders.map((folder) {
                    final folderConvs = allUnpinned.where((c) => c.folderId == folder.id).toList();
                    return ExpansionTile(
                      leading: Icon(Icons.folder, size: 16, color: Color(int.parse(folder.color.replaceFirst('#', '0xFF')))),
                      title: Text('${folder.name} (${folderConvs.length})',
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete, size: 14, color: AppColors.textDim),
                        onPressed: () => ref.read(folderProvider.notifier).deleteFolder(folder.id),
                      ),
                      childrenPadding: EdgeInsets.zero,
                      children: folderConvs.map((c) => _ConvTile(
                        conv: c, isActive: c.id == state.activeId,
                        onExport: () => _showExportDialog(c.id, c.title),
                        onShare: () => _showShareDialog(c.id),
                        folders: folders,
                      )).toList(),
                    );
                  }),

                  // Unfoldered
                  ...unfolderedUnpinned.map((c) => _ConvTile(
                    conv: c, isActive: c.id == state.activeId,
                    onExport: () => _showExportDialog(c.id, c.title),
                    onShare: () => _showShareDialog(c.id),
                    folders: folders,
                  )),

                  if (state.conversations.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(32),
                      child: Text('No conversations yet', textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.textDim, fontSize: 13)),
                    ),

                  // New folder button
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: OutlinedButton.icon(
                      onPressed: _showCreateFolder,
                      icon: const Icon(Icons.create_new_folder, size: 16),
                      label: const Text('New folder', style: TextStyle(fontSize: 12)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textMuted,
                        side: const BorderSide(color: AppColors.cardBorder),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Bottom: user info
          if (user != null) ...[
            const Divider(color: AppColors.cardBorder, height: 1),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: AppColors.violet600,
                    child: Text(user.username[0].toUpperCase(),
                      style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user.username, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13)),
                        Text(
                          user.isAdmin ? 'Admin' : '${user.balance.toStringAsFixed(2)} credits',
                          style: const TextStyle(color: AppColors.textDim, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ConvTile extends ConsumerStatefulWidget {
  final dynamic conv;
  final bool isActive;
  final VoidCallback onExport;
  final VoidCallback onShare;
  final List<Folder> folders;

  const _ConvTile({
    required this.conv,
    required this.isActive,
    required this.onExport,
    required this.onShare,
    this.folders = const [],
  });

  @override
  ConsumerState<_ConvTile> createState() => _ConvTileState();
}

class _ConvTileState extends ConsumerState<_ConvTile> {
  bool _editing = false;
  late TextEditingController _editCtrl;

  @override
  void initState() {
    super.initState();
    _editCtrl = TextEditingController(text: widget.conv.title);
  }

  @override
  void dispose() {
    _editCtrl.dispose();
    super.dispose();
  }

  void _saveRename() {
    final newTitle = _editCtrl.text.trim();
    if (newTitle.isNotEmpty && newTitle != widget.conv.title) {
      ref.read(conversationProvider.notifier).updateConversation(widget.conv.id, {'title': newTitle});
    }
    setState(() => _editing = false);
  }

  void _showMoveToFolder() {
    final folders = widget.folders;
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Move to folder', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ),
            if (widget.conv.folderId != null)
              ListTile(
                leading: const Icon(Icons.folder_off, size: 20),
                title: const Text('Remove from folder'),
                onTap: () {
                  ref.read(conversationProvider.notifier).moveToFolder(widget.conv.id, null);
                  Navigator.pop(ctx);
                },
              ),
            ...folders.map((f) => ListTile(
              leading: Icon(Icons.folder, size: 20,
                color: Color(int.parse(f.color.replaceFirst('#', '0xFF')))),
              title: Text(f.name),
              trailing: widget.conv.folderId == f.id
                ? const Icon(Icons.check, size: 16, color: AppColors.violet400)
                : null,
              onTap: () {
                ref.read(conversationProvider.notifier).moveToFolder(widget.conv.id, f.id);
                Navigator.pop(ctx);
              },
            )),
            if (folders.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('No folders yet. Create one first.',
                  style: TextStyle(color: AppColors.textDim, fontSize: 13)),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final conv = widget.conv;
    final isActive = widget.isActive;

    return Dismissible(
      key: Key(conv.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: AppColors.error.withOpacity(0.2),
        child: const Icon(Icons.delete, color: AppColors.error, size: 20),
      ),
      confirmDismiss: (_) async {
        return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Delete conversation?'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Delete', style: TextStyle(color: AppColors.error)),
              ),
            ],
          ),
        ) ?? false;
      },
      onDismissed: (_) => ref.read(conversationProvider.notifier).deleteConversation(conv.id),
      child: ListTile(
        dense: true,
        selected: isActive,
        selectedTileColor: AppColors.violet600.withOpacity(0.1),
        leading: Icon(
          conv.pinned ? Icons.push_pin : Icons.chat_bubble_outline,
          size: 16,
          color: isActive ? AppColors.violet400 : AppColors.textDim,
        ),
        title: _editing
          ? TextField(
              controller: _editCtrl,
              autofocus: true,
              style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
              decoration: const InputDecoration(
                isDense: true, border: InputBorder.none,
                contentPadding: EdgeInsets.zero,
              ),
              onSubmitted: (_) => _saveRename(),
            )
          : Text(conv.title,
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: isActive ? AppColors.textPrimary : AppColors.textSecondary,
                fontSize: 13, fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
        subtitle: !_editing && conv.lastMessage != null
          ? Text(conv.lastMessage!, maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.textDim, fontSize: 11))
          : null,
        trailing: _editing
          ? Row(mainAxisSize: MainAxisSize.min, children: [
              IconButton(
                icon: const Icon(Icons.check, size: 16, color: AppColors.success),
                onPressed: _saveRename,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.close, size: 16, color: AppColors.textDim),
                onPressed: () => setState(() => _editing = false),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ])
          : PopupMenuButton<String>(
              iconSize: 16,
              icon: const Icon(Icons.more_vert, size: 16, color: AppColors.textDim),
              onSelected: (action) {
                switch (action) {
                  case 'pin':
                    ref.read(conversationProvider.notifier).togglePin(conv.id);
                  case 'rename':
                    _editCtrl.text = conv.title;
                    setState(() => _editing = true);
                  case 'folder':
                    _showMoveToFolder();
                  case 'export':
                    widget.onExport();
                  case 'share':
                    widget.onShare();
                }
              },
              itemBuilder: (_) => [
                PopupMenuItem(value: 'pin', child: Row(children: [
                  Icon(conv.pinned ? Icons.push_pin_outlined : Icons.push_pin, size: 16, color: AppColors.textMuted),
                  const SizedBox(width: 8),
                  Text(conv.pinned ? 'Unpin' : 'Pin'),
                ])),
                const PopupMenuItem(value: 'rename', child: Row(children: [
                  Icon(Icons.edit, size: 16, color: AppColors.textMuted),
                  SizedBox(width: 8),
                  Text('Rename'),
                ])),
                const PopupMenuItem(value: 'folder', child: Row(children: [
                  Icon(Icons.folder_open, size: 16, color: AppColors.textMuted),
                  SizedBox(width: 8),
                  Text('Move to folder'),
                ])),
                const PopupMenuItem(value: 'export', child: Row(children: [
                  Icon(Icons.download, size: 16, color: AppColors.textMuted),
                  SizedBox(width: 8),
                  Text('Export'),
                ])),
                const PopupMenuItem(value: 'share', child: Row(children: [
                  Icon(Icons.share, size: 16, color: AppColors.textMuted),
                  SizedBox(width: 8),
                  Text('Share'),
                ])),
              ],
            ),
        onTap: () {
          ref.read(conversationProvider.notifier).selectConversation(conv.id);
          Navigator.of(context).pop();
        },
        onLongPress: () {
          ref.read(conversationProvider.notifier).togglePin(conv.id);
        },
      ),
    );
  }
}
