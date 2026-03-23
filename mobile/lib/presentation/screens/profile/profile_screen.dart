import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/datasources/remote/auth_api.dart';
import '../../../data/datasources/remote/model_api.dart';
import '../../../providers/auth_provider.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _showPasswordForm = false;
  final _currentPwCtrl = TextEditingController();
  final _newPwCtrl = TextEditingController();
  final _confirmPwCtrl = TextEditingController();
  String? _pwError;
  bool _saving = false;

  @override
  void dispose() {
    _currentPwCtrl.dispose();
    _newPwCtrl.dispose();
    _confirmPwCtrl.dispose();
    super.dispose();
  }

  void _showPricingInfo() async {
    Map<String, List<Map<String, dynamic>>>? pricing;
    try {
      final api = ModelApi(ref.read(apiClientProvider));
      pricing = await api.getPricing();
    } catch (_) {}
    if (!mounted || pricing == null) return;
    final pricingData = pricing!;

    const providerNames = {
      'anthropic': 'Anthropic (Claude)',
      'openai': 'OpenAI',
      'gemini': 'Google (Gemini)',
      'deepseek': 'DeepSeek',
      'kimi': 'Kimi',
    };

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.75,
        maxChildSize: 0.9,
        builder: (ctx, scrollCtrl) => Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: ListView(
            controller: scrollCtrl,
            padding: const EdgeInsets.all(20),
            children: [
              Row(children: [
                const Icon(Icons.info_outline, color: AppColors.violet400, size: 20),
                const SizedBox(width: 8),
                const Text('Тарифы и кредиты', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                const Spacer(),
                IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => Navigator.pop(ctx)),
              ]),
              const SizedBox(height: 16),

              // What are credits
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.violet600.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.violet600.withOpacity(0.2)),
                ),
                child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Что такое кредиты?', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.violet400)),
                  SizedBox(height: 6),
                  Text('Кредиты — валюта для оплаты ответов AI. Списание только за выходные токены (текст модели). Ваш запрос — бесплатно.',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  SizedBox(height: 4),
                  Text('1 кредит = 1 рубль при пополнении.',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
                ]),
              ),
              const SizedBox(height: 12),

              // Examples
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.cardBorder),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Примеры расхода', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                  const SizedBox(height: 8),
                  ...[
                    ('Простой вопрос (Sonnet)', '~0.5−1.5 кр'),
                    ('Развёрнутый ответ (Sonnet)', '~2.5−7.5 кр'),
                    ('GPT-4o mini', '~0.03−0.09 кр'),
                    ('Gemini Flash', '~0.02−0.05 кр'),
                    ('DeepSeek V3', '~0.04−0.12 кр'),
                  ].map((e) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Row(children: [
                      Expanded(child: Text(e.$1, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary))),
                      Text(e.$2, style: const TextStyle(fontSize: 11, color: Colors.amber, fontFamily: 'monospace')),
                    ]),
                  )),
                ]),
              ),
              const SizedBox(height: 16),

              // Pricing table
              const Text('Стоимость моделей (кредитов за 1K токенов)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              const SizedBox(height: 8),
              ...pricingData.entries.map((entry) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: AppColors.surfaceLight, borderRadius: BorderRadius.circular(8)),
                    child: Text(providerNames[entry.key] ?? entry.key, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
                  ),
                  ...entry.value.map((m) {
                    final price = (m['pricePer1k'] as num).toDouble();
                    final color = price <= 0.5 ? Colors.green : price <= 3 ? Colors.amber : price <= 10 ? Colors.orange : Colors.red;
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                      child: Row(children: [
                        Expanded(child: Text(m['name'] as String, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary))),
                        Text('$price кр', style: TextStyle(fontSize: 12, fontFamily: 'monospace', color: color)),
                      ]),
                    );
                  }),
                  const SizedBox(height: 8),
                ],
              )),

              const SizedBox(height: 8),
              const Text('Стоимость = (токены / 1000) × цена модели\nСтоимость каждого ответа видна под сообщением.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 10, color: AppColors.textDim)),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _savePassword() async {
    final user = ref.read(authProvider).user;
    if (_newPwCtrl.text.length < 6) { setState(() => _pwError = 'Min 6 characters'); return; }
    if (_newPwCtrl.text != _confirmPwCtrl.text) { setState(() => _pwError = 'Passwords do not match'); return; }

    setState(() { _saving = true; _pwError = null; });
    try {
      final api = ref.read(authApiProvider);
      await api.setPassword(
        currentPassword: user?.hasPassword == true ? _currentPwCtrl.text : null,
        newPassword: _newPwCtrl.text,
      );
      _currentPwCtrl.clear();
      _newPwCtrl.clear();
      _confirmPwCtrl.clear();
      setState(() => _showPasswordForm = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password saved')));
    } catch (e) {
      setState(() => _pwError = 'Error saving password');
    } finally {
      setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    if (user == null) return const SizedBox.shrink();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Profile', style: TextStyle(fontSize: 16))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // User info
          Card(child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: AppColors.violet600,
                child: Text(user.username[0].toUpperCase(),
                  style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 16),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(user.username, style: const TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600)),
                  Text(user.isAdmin ? 'Admin' : 'User', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                ],
              )),
            ]),
          )),

          if (user.email != null)
            Card(child: ListTile(
              leading: const Icon(Icons.email_outlined, size: 18, color: AppColors.textMuted),
              title: Text(user.email!, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
            )),

          const SizedBox(height: 8),

          // Password section
          Card(child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const Icon(Icons.lock_outline, size: 16, color: AppColors.textSecondary),
                  const SizedBox(width: 8),
                  const Text('Password', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w500)),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: user.hasPassword == true ? AppColors.success.withOpacity(0.15) : AppColors.warning.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      user.hasPassword == true ? 'Set' : 'Not set',
                      style: TextStyle(color: user.hasPassword == true ? AppColors.success : AppColors.warning, fontSize: 11),
                    ),
                  ),
                ]),
                const SizedBox(height: 12),
                if (!_showPasswordForm)
                  SizedBox(width: double.infinity, child: OutlinedButton(
                    onPressed: () => setState(() => _showPasswordForm = true),
                    style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.cardBorder)),
                    child: Text(user.hasPassword == true ? 'Change password' : 'Set password'),
                  ))
                else ...[
                  if (user.hasPassword == true)
                    TextField(
                      controller: _currentPwCtrl,
                      obscureText: true,
                      style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                      decoration: const InputDecoration(hintText: 'Current password', isDense: true),
                    ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _newPwCtrl,
                    obscureText: true,
                    style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                    decoration: const InputDecoration(hintText: 'New password', isDense: true),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _confirmPwCtrl,
                    obscureText: true,
                    style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                    decoration: const InputDecoration(hintText: 'Confirm password', isDense: true),
                  ),
                  if (_pwError != null) ...[
                    const SizedBox(height: 8),
                    Text(_pwError!, style: const TextStyle(color: AppColors.error, fontSize: 12)),
                  ],
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: ElevatedButton(
                      onPressed: _saving ? null : _savePassword,
                      child: _saving
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Save'),
                    )),
                    const SizedBox(width: 8),
                    TextButton(
                      onPressed: () => setState(() { _showPasswordForm = false; _pwError = null; }),
                      child: const Text('Cancel'),
                    ),
                  ]),
                ],
              ],
            ),
          )),

          const SizedBox(height: 8),

          // Balance & Payment
          if (!user.isAdmin)
            Card(child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    const Icon(Icons.account_balance_wallet, size: 16, color: AppColors.violet400),
                    const SizedBox(width: 8),
                    const Text('Баланс', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w500)),
                    const Spacer(),
                    Text('${user.balance.toStringAsFixed(2)} кр.',
                      style: TextStyle(color: user.balance < 1 ? AppColors.error : AppColors.success, fontSize: 14, fontWeight: FontWeight.bold)),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: ElevatedButton.icon(
                      onPressed: () async {
                        final uri = Uri.parse('https://t.me/UspAIChatbot?start=pay');
                        if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
                      },
                      icon: const Icon(Icons.telegram, size: 16),
                      label: const Text('Пополнить'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.telegram,
                        foregroundColor: Colors.white,
                      ),
                    )),
                    const SizedBox(width: 8),
                    OutlinedButton.icon(
                      onPressed: _showPricingInfo,
                      icon: const Icon(Icons.info_outline, size: 14),
                      label: const Text('Тарифы'),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.cardBorder),
                        foregroundColor: AppColors.violet400,
                      ),
                    ),
                  ]),
                ],
              ),
            )),

          const SizedBox(height: 8),

          // Referral
          Card(child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const Icon(Icons.people, size: 16, color: AppColors.violet400),
                  const SizedBox(width: 8),
                  const Text('Реферальная программа', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w500)),
                ]),
                const SizedBox(height: 12),
                if (user.referralCode != null) ...[
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLight,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.cardBorder),
                    ),
                    child: Row(children: [
                      Expanded(child: Text(
                        'https://t.me/UspAIChatbot?start=ref_${user.referralCode}',
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                        overflow: TextOverflow.ellipsis,
                      )),
                      IconButton(
                        icon: const Icon(Icons.copy, size: 16, color: AppColors.violet400),
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: 'https://t.me/UspAIChatbot?start=ref_${user.referralCode}'));
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ссылка скопирована')));
                        },
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        icon: const Icon(Icons.share, size: 16, color: AppColors.violet400),
                        onPressed: () => Share.share(
                          'Привет! Присоединяйся к UspAIChat — AI чат с множеством моделей. Регистрируйся и получи бонус!\nhttps://t.me/UspAIChatbot?start=ref_${user.referralCode}',
                        ),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      ),
                    ]),
                  ),
                  const SizedBox(height: 8),
                  const Text('Приглашай друзей и получай 50 кредитов + 10% от первого пополнения!',
                    style: TextStyle(color: AppColors.textDim, fontSize: 11)),
                ] else
                  const Text('Реферальный код будет доступен после входа через Telegram',
                    style: TextStyle(color: AppColors.textDim, fontSize: 12)),
              ],
            ),
          )),

          const SizedBox(height: 8),

          // Telegram section
          Card(child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const Icon(Icons.telegram, size: 16, color: AppColors.telegram),
                  const SizedBox(width: 8),
                  const Text('Telegram', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w500)),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: user.telegramId != null ? AppColors.success.withOpacity(0.15) : AppColors.textDim.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      user.telegramId != null ? 'Linked' : 'Not linked',
                      style: TextStyle(color: user.telegramId != null ? AppColors.success : AppColors.textMuted, fontSize: 11),
                    ),
                  ),
                ]),
                const SizedBox(height: 12),
                if (user.telegramId != null)
                  Text(user.telegramUsername != null ? '@${user.telegramUsername}' : 'ID ${user.telegramId}',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 13))
                else
                  const Text('Link Telegram to sign in with it',
                    style: TextStyle(color: AppColors.textDim, fontSize: 12)),
              ],
            ),
          )),
        ],
      ),
    );
  }
}
