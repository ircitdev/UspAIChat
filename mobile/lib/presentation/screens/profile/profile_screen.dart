import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/constants/api_constants.dart';
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
  bool _googleLinking = false;
  bool _appleLinking = false;

  // Referral state
  Map<String, dynamic>? _referralInfo;
  bool _referralLoading = false;
  bool _withdrawing = false;

  @override
  void initState() {
    super.initState();
    _loadReferralInfo();
  }

  @override
  void dispose() {
    _currentPwCtrl.dispose();
    _newPwCtrl.dispose();
    _confirmPwCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadReferralInfo() async {
    setState(() => _referralLoading = true);
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get(ApiConstants.referralInfo);
      if (mounted) setState(() => _referralInfo = response.data as Map<String, dynamic>);
    } catch (_) {}
    if (mounted) setState(() => _referralLoading = false);
  }

  Future<void> _withdrawReferral() async {
    setState(() => _withdrawing = true);
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.post(ApiConstants.referralWithdraw);
      final data = response.data as Map<String, dynamic>;
      if (data['new_balance'] != null) {
        ref.read(authProvider.notifier).updateBalance((data['new_balance'] as num).toDouble());
      }
      await _loadReferralInfo();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Выведено ${data['withdrawn']?.toString() ?? ''} кр. на баланс')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ошибка вывода')),
        );
      }
    }
    if (mounted) setState(() => _withdrawing = false);
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

  void _showPaymentSheet() async {
    List<Map<String, dynamic>>? packages;
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get(ApiConstants.paymentPackages);
      packages = (response.data as List).map((e) => e as Map<String, dynamic>).toList();
    } catch (_) {}
    if (!mounted || packages == null || packages.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Не удалось загрузить пакеты')),
        );
      }
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _PaymentSheetContent(
        packages: packages!,
        apiClient: ref.read(apiClientProvider),
      ),
    );
  }

  void _showPaymentHistory() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _PaymentHistorySheet(
        apiClient: ref.read(apiClientProvider),
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

  Future<void> _linkGoogle() async {
    setState(() => _googleLinking = true);
    try {
      final api = ref.read(authApiProvider);
      final config = await api.getOAuthConfig();
      final clientId = config['google_client_id'];
      if (clientId == null) throw Exception('Google Sign-In not configured');

      final googleSignIn = GoogleSignIn(serverClientId: clientId);
      final account = await googleSignIn.signIn();
      if (account == null) { setState(() => _googleLinking = false); return; }
      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) throw Exception('Failed to get Google ID token');

      final updatedUser = await api.linkGoogle(idToken);
      ref.read(authProvider.notifier).updateUser(updatedUser);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Google аккаунт привязан')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ошибка: $e')));
    } finally {
      if (mounted) setState(() => _googleLinking = false);
    }
  }

  Future<void> _unlinkGoogle() async {
    setState(() => _googleLinking = true);
    try {
      final api = ref.read(authApiProvider);
      final updatedUser = await api.unlinkGoogle();
      ref.read(authProvider.notifier).updateUser(updatedUser);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Google аккаунт отвязан')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ошибка: $e')));
    } finally {
      if (mounted) setState(() => _googleLinking = false);
    }
  }

  Future<void> _linkApple() async {
    setState(() => _appleLinking = true);
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
      );
      final idToken = credential.identityToken;
      if (idToken == null) throw Exception('Failed to get Apple ID token');

      final api = ref.read(authApiProvider);
      final updatedUser = await api.linkApple(idToken);
      ref.read(authProvider.notifier).updateUser(updatedUser);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Apple аккаунт привязан')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ошибка: $e')));
    } finally {
      if (mounted) setState(() => _appleLinking = false);
    }
  }

  Future<void> _unlinkApple() async {
    setState(() => _appleLinking = true);
    try {
      final api = ref.read(authApiProvider);
      final updatedUser = await api.unlinkApple();
      ref.read(authProvider.notifier).updateUser(updatedUser);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Apple аккаунт отвязан')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ошибка: $e')));
    } finally {
      if (mounted) setState(() => _appleLinking = false);
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

          // Balance & Payment (enhanced with 3 action buttons)
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
                    Expanded(child: _ActionButton(
                      icon: Icons.add_card,
                      label: 'Пополнить',
                      color: AppColors.violet600,
                      textColor: Colors.white,
                      onTap: _showPaymentSheet,
                    )),
                    const SizedBox(width: 8),
                    Expanded(child: _ActionButton(
                      icon: Icons.history,
                      label: 'История',
                      color: AppColors.surfaceLight,
                      textColor: AppColors.textSecondary,
                      borderColor: AppColors.cardBorder,
                      onTap: _showPaymentHistory,
                    )),
                    const SizedBox(width: 8),
                    Expanded(child: _ActionButton(
                      icon: Icons.info_outline,
                      label: 'Тарифы',
                      color: AppColors.surfaceLight,
                      textColor: AppColors.violet400,
                      borderColor: AppColors.cardBorder,
                      onTap: _showPricingInfo,
                    )),
                  ]),
                ],
              ),
            )),

          const SizedBox(height: 8),

          // Referral (enhanced with stats, withdraw, bonus info)
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

                // Referral stats
                if (_referralLoading)
                  const Center(child: Padding(
                    padding: EdgeInsets.all(8),
                    child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                  ))
                else if (_referralInfo != null) ...[
                  Row(children: [
                    Expanded(child: _StatBox(
                      value: '${_referralInfo!['total_referred'] ?? 0}',
                      label: 'Приглашено',
                      color: AppColors.violet400,
                    )),
                    const SizedBox(width: 8),
                    Expanded(child: _StatBox(
                      value: '${(_referralInfo!['total_earned'] as num?)?.round() ?? 0}',
                      label: 'Заработано',
                      color: AppColors.success,
                    )),
                    const SizedBox(width: 8),
                    Expanded(child: _StatBox(
                      value: '${(_referralInfo!['available_earnings'] as num?)?.round() ?? 0}',
                      label: 'Доступно',
                      color: Colors.orange,
                    )),
                  ]),
                  const SizedBox(height: 12),

                  // Withdraw button
                  if ((_referralInfo!['available_earnings'] as num?)?.toDouble() != null &&
                      (_referralInfo!['available_earnings'] as num).toDouble() > 0)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _withdrawing ? null : _withdrawReferral,
                          icon: _withdrawing
                            ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.download, size: 16),
                          label: Text('Вывести ${(_referralInfo!['available_earnings'] as num).round()} кр. на баланс'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.success,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                    ),

                  // Bonus info
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.violet600.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.violet600.withOpacity(0.15)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('За каждого друга:', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                        const SizedBox(height: 4),
                        Text(
                          '${_referralInfo!['bonus_referrer'] ?? 50} кредитов + ${_referralInfo!['bonus_percent'] ?? 10}% от пополнения друга',
                          style: const TextStyle(fontSize: 12, color: AppColors.success, fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Друг получит: ${_referralInfo!['bonus_referred'] ?? 50} кредитов',
                          style: const TextStyle(fontSize: 11, color: AppColors.violet400),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                // Referral link
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

          const SizedBox(height: 8),

          // Google section
          Card(child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const Icon(Icons.g_mobiledata, size: 20, color: AppColors.google),
                  const SizedBox(width: 8),
                  const Text('Google', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w500)),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: user.googleId != null ? AppColors.success.withOpacity(0.15) : AppColors.textDim.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      user.googleId != null ? 'Linked' : 'Not linked',
                      style: TextStyle(color: user.googleId != null ? AppColors.success : AppColors.textMuted, fontSize: 11),
                    ),
                  ),
                ]),
                const SizedBox(height: 12),
                if (user.googleId != null) ...[
                  const Text('Google аккаунт привязан',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                  const SizedBox(height: 8),
                  SizedBox(width: double.infinity, child: OutlinedButton(
                    onPressed: _googleLinking ? null : _unlinkGoogle,
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.cardBorder),
                      foregroundColor: AppColors.error,
                    ),
                    child: _googleLinking
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Отвязать'),
                  )),
                ] else
                  SizedBox(width: double.infinity, child: ElevatedButton.icon(
                    onPressed: _googleLinking ? null : _linkGoogle,
                    icon: _googleLinking
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.g_mobiledata, size: 20),
                    label: const Text('Привязать Google'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.google,
                      foregroundColor: Colors.white,
                    ),
                  )),
              ],
            ),
          )),

          const SizedBox(height: 8),

          // Apple section (iOS only)
          if (Platform.isIOS)
            Card(child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    const Icon(Icons.apple, size: 18, color: AppColors.apple),
                    const SizedBox(width: 8),
                    const Text('Apple', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w500)),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: user.appleId != null ? AppColors.success.withOpacity(0.15) : AppColors.textDim.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        user.appleId != null ? 'Linked' : 'Not linked',
                        style: TextStyle(color: user.appleId != null ? AppColors.success : AppColors.textMuted, fontSize: 11),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  if (user.appleId != null) ...[
                    const Text('Apple аккаунт привязан',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                    const SizedBox(height: 8),
                    SizedBox(width: double.infinity, child: OutlinedButton(
                      onPressed: _appleLinking ? null : _unlinkApple,
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.cardBorder),
                        foregroundColor: AppColors.error,
                      ),
                      child: _appleLinking
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Отвязать'),
                    )),
                  ] else
                    SizedBox(width: double.infinity, child: ElevatedButton.icon(
                      onPressed: _appleLinking ? null : _linkApple,
                      icon: _appleLinking
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.apple, size: 18),
                      label: const Text('Привязать Apple'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.black,
                        foregroundColor: Colors.white,
                      ),
                    )),
                ],
              ),
            )),
        ],
      ),
    );
  }
}

// ─── Action Button Widget ───────────────────────────────────────

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final Color textColor;
  final Color? borderColor;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.textColor,
    this.borderColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: borderColor != null
            ? BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: borderColor!),
              )
            : null,
          child: Column(
            children: [
              Icon(icon, size: 18, color: textColor),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(fontSize: 11, color: textColor, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Stat Box Widget ────────────────────────────────────────────

class _StatBox extends StatelessWidget {
  final String value;
  final String label;
  final Color color;

  const _StatBox({required this.value, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        children: [
          Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
        ],
      ),
    );
  }
}

// ─── Payment Sheet ──────────────────────────────────────────────

class _PaymentSheetContent extends StatefulWidget {
  final List<Map<String, dynamic>> packages;
  final dynamic apiClient;

  const _PaymentSheetContent({required this.packages, required this.apiClient});

  @override
  State<_PaymentSheetContent> createState() => _PaymentSheetContentState();
}

class _PaymentSheetContentState extends State<_PaymentSheetContent> {
  late Map<String, dynamic> _selectedPkg;
  final _promoCtrl = TextEditingController();
  Map<String, dynamic>? _promoResult;
  bool _promoLoading = false;
  bool _payLoading = false;

  @override
  void initState() {
    super.initState();
    _selectedPkg = widget.packages.first;
  }

  @override
  void dispose() {
    _promoCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkPromo() async {
    final code = _promoCtrl.text.trim();
    if (code.isEmpty) return;
    setState(() => _promoLoading = true);
    try {
      final response = await widget.apiClient.dio.get(ApiConstants.promoCheck(code));
      setState(() => _promoResult = response.data as Map<String, dynamic>);
    } catch (_) {
      setState(() => _promoResult = {'valid': false, 'error': 'Ошибка проверки'});
    }
    setState(() => _promoLoading = false);
  }

  double get _promoBonus {
    if (_promoResult == null || _promoResult!['valid'] != true) return 0;
    final credits = (_selectedPkg['credits'] as num).toDouble();
    final type = _promoResult!['type'] as String?;
    final value = (_promoResult!['value'] as num?)?.toDouble() ?? 0;
    switch (type) {
      case 'bonus': return credits * (value / 100);
      case 'discount': return credits * (value / 100);
      case 'fixed': return value;
      default: return 0;
    }
  }

  double get _totalCredits {
    final credits = (_selectedPkg['credits'] as num).toDouble();
    final bonus = (_selectedPkg['bonus'] as num?)?.toDouble() ?? 0;
    return credits + bonus + _promoBonus;
  }

  Future<void> _handlePay() async {
    setState(() => _payLoading = true);
    try {
      final data = {
        'amount': _selectedPkg['amount'],
        if (_promoResult?['valid'] == true) 'promo_code': _promoCtrl.text.trim(),
      };
      final response = await widget.apiClient.dio.post(ApiConstants.paymentCreate, data: data);
      final result = response.data as Map<String, dynamic>;
      final url = result['confirmation_url'] as String?;
      if (url != null && mounted) {
        Navigator.pop(context);
        final uri = Uri.parse(url);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ошибка создания платежа')),
        );
      }
    }
    if (mounted) setState(() => _payLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
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
            // Header
            Row(children: [
              const Icon(Icons.add_card, color: AppColors.violet400, size: 20),
              const SizedBox(width: 8),
              const Text('Пополнить баланс', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
              const Spacer(),
              IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => Navigator.pop(ctx)),
            ]),
            const SizedBox(height: 4),
            const Text('Выберите пакет:', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            const SizedBox(height: 12),

            // Packages grid
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                childAspectRatio: 1.6,
              ),
              itemCount: widget.packages.length,
              itemBuilder: (ctx, i) {
                final pkg = widget.packages[i];
                final selected = pkg['amount'] == _selectedPkg['amount'];
                final bonus = (pkg['bonus'] as num?)?.toInt() ?? 0;
                return GestureDetector(
                  onTap: () => setState(() => _selectedPkg = pkg),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: selected ? AppColors.violet600.withOpacity(0.12) : AppColors.surfaceLight,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: selected ? AppColors.violet600 : AppColors.cardBorder,
                        width: selected ? 1.5 : 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          pkg['label'] as String? ?? '${pkg['amount']} ₽',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 4),
                        Row(children: [
                          Text(
                            '${pkg['credits']} кр.',
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                          if (bonus > 0) ...[
                            const SizedBox(width: 4),
                            Text(
                              '+$bonus',
                              style: const TextStyle(fontSize: 12, color: AppColors.success, fontWeight: FontWeight.w500),
                            ),
                          ],
                        ]),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 16),

            // Promo code
            const Text('Промо-код', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
            const SizedBox(height: 6),
            Row(children: [
              Expanded(child: TextField(
                controller: _promoCtrl,
                style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  hintText: 'Введите код',
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  filled: true,
                  fillColor: AppColors.surfaceLight,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.cardBorder),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.cardBorder),
                  ),
                ),
                onChanged: (_) => setState(() => _promoResult = null),
              )),
              const SizedBox(width: 8),
              SizedBox(
                height: 38,
                child: ElevatedButton(
                  onPressed: _promoLoading ? null : _checkPromo,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.violet600,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: _promoLoading
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('OK', style: TextStyle(fontSize: 13)),
                ),
              ),
            ]),
            if (_promoResult != null) ...[
              const SizedBox(height: 6),
              Text(
                _promoResult!['valid'] == true
                  ? (_promoResult!['description'] as String? ?? 'Промо-код применён')
                  : (_promoResult!['error'] as String? ?? 'Недействительный код'),
                style: TextStyle(
                  fontSize: 12,
                  color: _promoResult!['valid'] == true ? AppColors.success : AppColors.error,
                ),
              ),
            ],
            const SizedBox(height: 16),

            // Summary
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.cardBorder),
              ),
              child: Column(children: [
                _SummaryRow(label: 'Сумма', value: '${_selectedPkg['amount']} ₽'),
                _SummaryRow(label: 'Кредиты', value: '${_selectedPkg['credits']}'),
                if ((_selectedPkg['bonus'] as num?)?.toInt() != null && (_selectedPkg['bonus'] as num).toInt() > 0)
                  _SummaryRow(label: 'Бонус пакета', value: '+${(_selectedPkg['bonus'] as num).toInt()}', valueColor: AppColors.success),
                if (_promoBonus > 0)
                  _SummaryRow(label: 'Бонус промо', value: '+${_promoBonus.round()}', valueColor: AppColors.success),
                const Divider(color: AppColors.cardBorder, height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Итого кредитов', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                    Text('${_totalCredits.round()}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                  ],
                ),
              ]),
            ),
            const SizedBox(height: 16),

            // Pay button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _payLoading ? null : _handlePay,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.violet600,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: _payLoading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text('Оплатить ${_selectedPkg['amount']} ₽', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Оплата через ЮKassa. После оплаты кредиты зачислятся автоматически.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 10, color: AppColors.textDim),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _SummaryRow({required this.label, required this.value, this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          Text(value, style: TextStyle(fontSize: 12, color: valueColor ?? AppColors.textSecondary)),
        ],
      ),
    );
  }
}

// ─── Payment History Sheet ──────────────────────────────────────

class _PaymentHistorySheet extends StatefulWidget {
  final dynamic apiClient;

  const _PaymentHistorySheet({required this.apiClient});

  @override
  State<_PaymentHistorySheet> createState() => _PaymentHistorySheetState();
}

class _PaymentHistorySheetState extends State<_PaymentHistorySheet> {
  List<Map<String, dynamic>> _history = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    try {
      final response = await widget.apiClient.dio.get(ApiConstants.paymentHistory);
      final data = response.data as List;
      setState(() {
        _history = data.map((e) => e as Map<String, dynamic>).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'succeeded': return AppColors.success;
      case 'pending': return AppColors.warning;
      default: return AppColors.error;
    }
  }

  String _statusLabel(String? status) {
    switch (status) {
      case 'succeeded': return 'Оплачен';
      case 'pending': return 'Ожидание';
      case 'canceled': return 'Отменён';
      default: return status ?? '';
    }
  }

  String _formatDate(dynamic timestamp) {
    if (timestamp == null) return '';
    final date = DateTime.fromMillisecondsSinceEpoch((timestamp as num).toInt() * 1000);
    return '${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      builder: (ctx, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
              child: Row(children: [
                const Icon(Icons.history, color: AppColors.violet400, size: 20),
                const SizedBox(width: 8),
                const Text('История платежей', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                const Spacer(),
                IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => Navigator.pop(ctx)),
              ]),
            ),
            Expanded(
              child: _loading
                ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                : _history.isEmpty
                  ? const Center(child: Text('Нет платежей', style: TextStyle(color: AppColors.textMuted, fontSize: 14)))
                  : ListView.builder(
                      controller: scrollCtrl,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      itemCount: _history.length,
                      itemBuilder: (ctx, i) {
                        final p = _history[i];
                        final status = p['status'] as String?;
                        final amount = p['amount'];
                        final credits = (p['credits'] as num?)?.round() ?? 0;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.background,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: _statusColor(status),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '$amount ₽  →  $credits кр.',
                                  style: const TextStyle(fontSize: 13, color: AppColors.textPrimary, fontWeight: FontWeight.w500),
                                ),
                                const SizedBox(height: 2),
                                Row(children: [
                                  Text(
                                    _statusLabel(status),
                                    style: TextStyle(fontSize: 11, color: _statusColor(status)),
                                  ),
                                  if (p['source'] != null) ...[
                                    const Text(' | ', style: TextStyle(fontSize: 11, color: AppColors.textDim)),
                                    Text(
                                      p['source'] == 'telegram' ? 'Telegram' : 'Web',
                                      style: const TextStyle(fontSize: 11, color: AppColors.textDim),
                                    ),
                                  ],
                                  if (p['promo_code'] != null) ...[
                                    const Text(' | ', style: TextStyle(fontSize: 11, color: AppColors.textDim)),
                                    Text(
                                      'Промо: ${p['promo_code']}',
                                      style: const TextStyle(fontSize: 11, color: AppColors.violet400),
                                    ),
                                  ],
                                ]),
                              ],
                            )),
                            Text(
                              _formatDate(p['created_at']),
                              style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                            ),
                          ]),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
