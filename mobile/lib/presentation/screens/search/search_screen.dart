import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/datasources/remote/conversation_api.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/conversation_provider.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _ctrl = TextEditingController();
  Timer? _debounce;
  List<Map<String, dynamic>> _results = [];
  bool _loading = false;

  @override
  void dispose() {
    _ctrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onChanged(String query) {
    _debounce?.cancel();
    if (query.trim().isEmpty) {
      setState(() => _results = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () => _search(query));
  }

  Future<void> _search(String query) async {
    setState(() => _loading = true);
    try {
      final api = ConversationApi(ref.read(apiClientProvider));
      final results = await api.searchMessages(query);
      setState(() { _results = results; _loading = false; });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  String _formatDate(dynamic timestamp) {
    if (timestamp == null) return '';
    final ts = timestamp is int ? timestamp : int.tryParse(timestamp.toString()) ?? 0;
    if (ts == 0) return '';
    final date = DateTime.fromMillisecondsSinceEpoch(ts * 1000);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final msgDay = DateTime(date.year, date.month, date.day);
    if (msgDay == today) return DateFormat('HH:mm').format(date);
    if (msgDay == today.subtract(const Duration(days: 1))) return 'Yesterday';
    return DateFormat('d MMM yyyy').format(date);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: TextField(
          controller: _ctrl,
          autofocus: true,
          onChanged: _onChanged,
          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
          decoration: InputDecoration(
            hintText: 'Search messages...',
            hintStyle: const TextStyle(color: AppColors.textDim, fontSize: 14),
            border: InputBorder.none,
            suffixIcon: _ctrl.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, size: 18, color: AppColors.textDim),
                  onPressed: () {
                    _ctrl.clear();
                    setState(() => _results = []);
                  },
                )
              : null,
          ),
        ),
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.violet600))
        : _results.isEmpty
          ? Center(child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _ctrl.text.isEmpty ? Icons.search : Icons.search_off,
                  size: 48,
                  color: AppColors.textDim.withOpacity(0.3),
                ),
                const SizedBox(height: 12),
                Text(
                  _ctrl.text.isEmpty ? 'Type to search messages' : 'No results found',
                  style: const TextStyle(color: AppColors.textDim, fontSize: 14),
                ),
              ],
            ))
          : ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 4),
              itemCount: _results.length,
              separatorBuilder: (_, __) => const Divider(color: AppColors.cardBorder, height: 1, indent: 16, endIndent: 16),
              itemBuilder: (_, i) {
                final r = _results[i];
                final dateStr = _formatDate(r['created_at']);
                return ListTile(
                  title: Row(
                    children: [
                      Expanded(
                        child: Text(r['conversation_title'] ?? '',
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w500)),
                      ),
                      if (dateStr.isNotEmpty)
                        Text(dateStr, style: const TextStyle(color: AppColors.textDim, fontSize: 11)),
                    ],
                  ),
                  subtitle: Text(r['content'] ?? '',
                    maxLines: 2, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                  leading: const Icon(Icons.chat_bubble_outline, size: 16, color: AppColors.textDim),
                  onTap: () {
                    ref.read(conversationProvider.notifier).selectConversation(r['conversation_id']);
                    Navigator.of(context).pop();
                  },
                );
              },
            ),
    );
  }
}
