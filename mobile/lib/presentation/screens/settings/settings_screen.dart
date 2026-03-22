import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/datasources/remote/model_api.dart';
import '../../../providers/auth_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  final _providers = ['anthropic', 'openai', 'gemini', 'deepseek', 'kimi'];
  Map<String, dynamic> _keyStatus = {};
  final _keyControllers = <String, TextEditingController>{};

  @override
  void initState() {
    super.initState();
    final isAdmin = ref.read(authProvider).user?.isAdmin == true;
    _tabCtrl = TabController(length: isAdmin ? 3 : 2, vsync: this);
    _loadKeys();
    for (final p in _providers) {
      _keyControllers[p] = TextEditingController();
    }
  }

  Future<void> _loadKeys() async {
    final api = ModelApi(ref.read(apiClientProvider));
    final status = await api.getKeyStatus();
    setState(() => _keyStatus = status);
  }

  Future<void> _saveKey(String provider) async {
    final key = _keyControllers[provider]!.text.trim();
    if (key.isEmpty) return;
    final api = ModelApi(ref.read(apiClientProvider));
    await api.saveKey(provider, key);
    _keyControllers[provider]!.clear();
    _loadKeys();
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Key saved')));
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    for (final c in _keyControllers.values) c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = ref.watch(authProvider).user?.isAdmin == true;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Settings', style: TextStyle(fontSize: 16)),
        bottom: TabBar(
          controller: _tabCtrl,
          indicatorColor: AppColors.violet600,
          labelColor: AppColors.textPrimary,
          unselectedLabelColor: AppColors.textMuted,
          tabs: [
            if (isAdmin) const Tab(text: 'API Keys'),
            const Tab(text: 'Language'),
            const Tab(text: 'About'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: [
          // API Keys tab (admin only)
          if (isAdmin) ListView(
            padding: const EdgeInsets.all(16),
            children: _providers.map((p) {
              final configured = (_keyStatus[p] as Map?)?['configured'] == true;
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Container(
                          width: 8, height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: configured ? AppColors.success : AppColors.textDim,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(p.toUpperCase(),
                          style: TextStyle(
                            color: AppColors.providerColor(p),
                            fontWeight: FontWeight.w600, fontSize: 13,
                          ),
                        ),
                        const Spacer(),
                        if (configured)
                          const Text('Configured', style: TextStyle(color: AppColors.success, fontSize: 11)),
                      ]),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _keyControllers[p],
                        obscureText: true,
                        style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                        decoration: InputDecoration(
                          hintText: 'Enter API key...',
                          isDense: true,
                          suffixIcon: IconButton(
                            icon: const Icon(Icons.save, size: 18, color: AppColors.violet400),
                            onPressed: () => _saveKey(p),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),

          // Language tab
          ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _langTile('Russian', 'ru'),
              _langTile('English', 'en'),
              _langTile('Chinese', 'zh'),
              const Divider(height: 32),
              ListTile(
                leading: const Icon(Icons.auto_awesome, color: AppColors.violet400),
                title: const Text('Prompt Templates', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: const Text('Manage your prompt templates', style: TextStyle(color: AppColors.textDim, fontSize: 12)),
                trailing: const Icon(Icons.chevron_right, color: AppColors.textDim),
                onTap: () => context.go('/prompt-templates'),
              ),
            ],
          ),

          // About tab
          ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const SizedBox(height: 24),
              Center(
                child: Container(
                  width: 64, height: 64,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    gradient: const LinearGradient(colors: [AppColors.violet600, AppColors.purple800]),
                  ),
                  child: const Icon(Icons.smart_toy, color: Colors.white, size: 32),
                ),
              ),
              const SizedBox(height: 16),
              const Center(child: Text('UspAIChat', style: TextStyle(
                color: AppColors.textPrimary, fontSize: 22, fontWeight: FontWeight.bold,
              ))),
              const SizedBox(height: 4),
              const Center(child: Text('v1.0.0', style: TextStyle(color: AppColors.textMuted, fontSize: 13))),
              const SizedBox(height: 24),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text('Multi-provider AI Chat', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
                      SizedBox(height: 8),
                      Text('Self-hosted AI chat platform with support for Anthropic Claude, OpenAI, Google Gemini, DeepSeek and Kimi.',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: Column(
                  children: [
                    ListTile(
                      dense: true,
                      leading: const Icon(Icons.code, size: 18, color: AppColors.violet400),
                      title: const Text('Developer', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      subtitle: const Text('IRCit Dev', style: TextStyle(color: AppColors.textPrimary, fontSize: 14)),
                    ),
                    const Divider(height: 1, color: AppColors.cardBorder),
                    ListTile(
                      dense: true,
                      leading: const Icon(Icons.language, size: 18, color: AppColors.violet400),
                      title: const Text('Website', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      subtitle: const Text('app.aifuturenow.ru', style: TextStyle(color: AppColors.textPrimary, fontSize: 14)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _langTile(String name, String code) {
    return ListTile(
      title: Text(name, style: const TextStyle(color: AppColors.textPrimary)),
      trailing: const Icon(Icons.chevron_right, color: AppColors.textDim),
      onTap: () {
        // TODO: implement locale change
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Language: $name')));
      },
    );
  }
}
