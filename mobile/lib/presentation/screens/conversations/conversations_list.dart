import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/conversation_provider.dart';

class ConversationsList extends ConsumerWidget {
  const ConversationsList({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(conversationProvider);
    final user = ref.watch(authProvider).user;
    final notifier = ref.read(conversationProvider.notifier);
    final pinned = state.pinned;
    final unpinned = state.unpinned;

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
              onRefresh: () => notifier.loadConversations(),
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 4),
                children: [
                  if (pinned.isNotEmpty) ...[
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
                      child: Text('Pinned', style: TextStyle(color: AppColors.textDim, fontSize: 11, fontWeight: FontWeight.w600)),
                    ),
                    ...pinned.map((c) => _ConvTile(conv: c, isActive: c.id == state.activeId)),
                    const Divider(color: AppColors.cardBorder, height: 1, indent: 16, endIndent: 16),
                  ],
                  ...unpinned.map((c) => _ConvTile(conv: c, isActive: c.id == state.activeId)),
                  if (state.conversations.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(32),
                      child: Text('No conversations yet', textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.textDim, fontSize: 13)),
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

class _ConvTile extends ConsumerWidget {
  final dynamic conv;
  final bool isActive;

  const _ConvTile({required this.conv, required this.isActive});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
        title: Text(conv.title,
          maxLines: 1, overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: isActive ? AppColors.textPrimary : AppColors.textSecondary,
            fontSize: 13, fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
        subtitle: conv.lastMessage != null
          ? Text(conv.lastMessage!, maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: AppColors.textDim, fontSize: 11))
          : null,
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
