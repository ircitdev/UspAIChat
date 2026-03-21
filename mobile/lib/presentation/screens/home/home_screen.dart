import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/conversation_provider.dart';
import '../chat/chat_screen.dart';
import '../conversations/conversations_list.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  @override
  void initState() {
    super.initState();
    ref.read(conversationProvider.notifier).loadConversations();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final convState = ref.watch(conversationProvider);
    final user = auth.user;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          convState.active?.title ?? 'UspAIChat',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search, size: 20),
            onPressed: () => context.go('/search'),
          ),
          IconButton(
            icon: const Icon(Icons.add, size: 20),
            onPressed: () async {
              await ref.read(conversationProvider.notifier).createConversation();
              if (context.mounted) Navigator.of(context).pop(); // close drawer if open
            },
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, size: 20),
            color: AppColors.surface,
            onSelected: (value) {
              switch (value) {
                case 'settings': context.go('/settings');
                case 'profile': context.go('/profile');
                case 'admin': context.go('/admin');
                case 'logout': ref.read(authProvider.notifier).logout();
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'settings', child: Text('Settings')),
              const PopupMenuItem(value: 'profile', child: Text('Profile')),
              if (user?.isAdmin == true)
                const PopupMenuItem(value: 'admin', child: Text('Admin Panel')),
              const PopupMenuDivider(),
              const PopupMenuItem(value: 'logout', child: Text('Logout', style: TextStyle(color: AppColors.error))),
            ],
          ),
        ],
      ),
      drawer: const Drawer(
        backgroundColor: AppColors.surface,
        child: ConversationsList(),
      ),
      body: convState.activeId != null
        ? const ChatScreen()
        : _EmptyState(),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56, height: 56,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: const LinearGradient(colors: [AppColors.violet600, AppColors.purple800]),
            ),
            child: const Icon(Icons.smart_toy, color: Colors.white, size: 28),
          ),
          const SizedBox(height: 16),
          const Text('Start a new chat', style: TextStyle(color: AppColors.textMuted, fontSize: 16)),
          const SizedBox(height: 8),
          const Text('Swipe right or tap + to begin', style: TextStyle(color: AppColors.textDim, fontSize: 13)),
        ],
      ),
    );
  }
}
