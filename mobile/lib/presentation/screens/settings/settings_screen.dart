import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
    _tabCtrl = TabController(length: 2, vsync: this);
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
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Settings', style: TextStyle(fontSize: 16)),
        bottom: TabBar(
          controller: _tabCtrl,
          indicatorColor: AppColors.violet600,
          labelColor: AppColors.textPrimary,
          unselectedLabelColor: AppColors.textMuted,
          tabs: const [
            Tab(text: 'API Keys'),
            Tab(text: 'Language'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: [
          // API Keys tab
          ListView(
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
