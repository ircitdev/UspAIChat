import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/api_constants.dart';
import '../../../providers/auth_provider.dart';

class AdminScreen extends ConsumerStatefulWidget {
  const AdminScreen({super.key});

  @override
  ConsumerState<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends ConsumerState<AdminScreen> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  Map<String, dynamic> _stats = {};
  List<dynamic> _users = [];
  List<dynamic> _transactions = [];
  bool _loading = true;

  Dio get _dio => ref.read(apiClientProvider).dio;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _dio.get(ApiConstants.adminStats),
        _dio.get(ApiConstants.adminUsers),
        _dio.get(ApiConstants.adminTransactions, queryParameters: {'limit': 50}),
      ]);
      setState(() {
        _stats = results[0].data;
        _users = results[1].data;
        _transactions = results[2].data;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Admin Panel', style: TextStyle(fontSize: 16)),
        bottom: TabBar(
          controller: _tabCtrl,
          indicatorColor: AppColors.violet600,
          labelColor: AppColors.textPrimary,
          unselectedLabelColor: AppColors.textMuted,
          tabs: const [
            Tab(text: 'Stats'),
            Tab(text: 'Users'),
            Tab(text: 'Balance'),
          ],
        ),
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.violet600))
        : TabBarView(
            controller: _tabCtrl,
            children: [
              _StatsTab(stats: _stats),
              _UsersTab(users: _users, onRefresh: _loadAll),
              _BalanceTab(transactions: _transactions),
            ],
          ),
    );
  }
}

class _StatsTab extends StatelessWidget {
  final Map<String, dynamic> stats;
  const _StatsTab({required this.stats});

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      padding: const EdgeInsets.all(16),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.6,
      children: [
        _StatCard('Users', '${stats['totalUsers'] ?? 0}', Icons.people),
        _StatCard('Admins', '${stats['adminUsers'] ?? 0}', Icons.admin_panel_settings),
        _StatCard('Conversations', '${stats['totalConvs'] ?? 0}', Icons.chat),
        _StatCard('Messages', '${stats['totalMessages'] ?? 0}', Icons.message),
        _StatCard('Top Up', '\$${((stats['totalTopup'] ?? 0) as num).toStringAsFixed(2)}', Icons.arrow_upward, color: AppColors.success),
        _StatCard('Charged', '\$${((stats['totalCharged'] ?? 0) as num).toStringAsFixed(2)}', Icons.arrow_downward, color: AppColors.error),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _StatCard(this.label, this.value, this.icon, {this.color = AppColors.violet400});

  @override
  Widget build(BuildContext context) {
    return Card(child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, size: 20, color: color),
          Text(value, style: TextStyle(color: AppColors.textPrimary, fontSize: 20, fontWeight: FontWeight.bold)),
          Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
        ],
      ),
    ));
  }
}

class _UsersTab extends StatelessWidget {
  final List<dynamic> users;
  final VoidCallback onRefresh;
  const _UsersTab({required this.users, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: users.length,
      itemBuilder: (_, i) {
        final u = users[i] as Map<String, dynamic>;
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: CircleAvatar(
              radius: 18,
              backgroundColor: u['role'] == 'admin' ? AppColors.warning : AppColors.violet600,
              child: Text((u['username'] ?? '?')[0].toUpperCase(),
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
            ),
            title: Text(u['username'] ?? '', style: const TextStyle(color: AppColors.textPrimary, fontSize: 14)),
            subtitle: Text('${u['email'] ?? 'No email'} | Balance: ${(u['balance'] as num?)?.toStringAsFixed(2) ?? '0'}',
              style: const TextStyle(color: AppColors.textDim, fontSize: 11)),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (u['is_blocked'] == 1)
                  const Icon(Icons.block, size: 16, color: AppColors.error),
                if (u['role'] == 'admin')
                  const Icon(Icons.star, size: 16, color: AppColors.warning),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _BalanceTab extends StatelessWidget {
  final List<dynamic> transactions;
  const _BalanceTab({required this.transactions});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: transactions.length,
      itemBuilder: (_, i) {
        final t = transactions[i] as Map<String, dynamic>;
        final isTopup = t['type'] == 'topup';
        return ListTile(
          dense: true,
          leading: Icon(
            isTopup ? Icons.add_circle : Icons.remove_circle,
            color: isTopup ? AppColors.success : AppColors.error,
            size: 20,
          ),
          title: Text('${t['username'] ?? ''} — ${t['description'] ?? t['type']}',
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13)),
          subtitle: Text('Balance after: ${(t['balance_after'] as num?)?.toStringAsFixed(4) ?? '0'}',
            style: const TextStyle(color: AppColors.textDim, fontSize: 11)),
          trailing: Text(
            '${isTopup ? '+' : ''}${(t['amount'] as num?)?.toStringAsFixed(4) ?? '0'}',
            style: TextStyle(
              color: isTopup ? AppColors.success : AppColors.error,
              fontWeight: FontWeight.w600, fontSize: 13,
            ),
          ),
        );
      },
    );
  }
}
