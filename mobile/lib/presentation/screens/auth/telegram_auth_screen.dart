import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/user_model.dart';
import '../../../providers/auth_provider.dart';

class TelegramAuthScreen extends ConsumerStatefulWidget {
  const TelegramAuthScreen({super.key});

  @override
  ConsumerState<TelegramAuthScreen> createState() => _TelegramAuthScreenState();
}

class _TelegramAuthScreenState extends ConsumerState<TelegramAuthScreen> {
  String? _code;
  String? _botUsername;
  String _status = 'loading'; // loading, waiting, expired, error
  String? _error;
  int _timeLeft = 0;
  Timer? _pollTimer;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _initTelegram();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _countdownTimer?.cancel();
    super.dispose();
  }

  Future<void> _initTelegram() async {
    setState(() { _status = 'loading'; _error = null; });
    try {
      final api = ref.read(authApiProvider);
      final data = await api.telegramInit();
      _code = data['code'] as String;
      _botUsername = data['bot_username'] as String;
      _timeLeft = data['expires_in'] as int;
      setState(() => _status = 'waiting');

      _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        setState(() {
          _timeLeft--;
          if (_timeLeft <= 0) { _countdownTimer?.cancel(); _status = 'expired'; }
        });
      });

      _pollTimer = Timer.periodic(const Duration(seconds: 2), (_) async {
        try {
          final poll = await api.telegramPoll(_code!);
          if (poll['status'] == 'confirmed') {
            _pollTimer?.cancel();
            _countdownTimer?.cancel();
            final client = ref.read(apiClientProvider);
            await client.saveTokens(poll['accessToken'], poll['refreshToken']);
            ref.read(authProvider.notifier).updateUser(
              User.fromJson(poll['user']),
            );
          } else if (poll['status'] == 'expired' || poll['status'] == 'not_found') {
            _pollTimer?.cancel();
            _countdownTimer?.cancel();
            setState(() { _status = 'expired'; _error = 'Код истёк'; });
          }
        } catch (_) {
          // Network error during poll — skip silently, next poll will retry
        }
      });
    } catch (e) {
      setState(() { _status = 'error'; _error = 'Не удалось подключиться к боту'; });
    }
  }

  String _formatTime(int s) => '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('Telegram', style: TextStyle(fontSize: 16)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textMuted),
          onPressed: () => context.go('/auth'),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.cardBorder),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_status == 'loading')
                    const CircularProgressIndicator(color: AppColors.telegram),

                  if (_status == 'waiting' && _code != null) ...[
                    Text('Отправьте этот код боту @$_botUsername',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
                    ),
                    const SizedBox(height: 20),
                    GestureDetector(
                      onTap: () {
                        Clipboard.setData(ClipboardData(text: _code!));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Код скопирован'), duration: Duration(seconds: 1)),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 16),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.cardBorder),
                        ),
                        child: Text(_code!,
                          style: const TextStyle(
                            color: AppColors.textPrimary, fontSize: 36,
                            fontWeight: FontWeight.bold, letterSpacing: 8,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(_formatTime(_timeLeft),
                      style: TextStyle(
                        color: _timeLeft < 60 ? AppColors.error : AppColors.textMuted,
                        fontSize: 12, fontFamily: 'monospace',
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      SizedBox(width: 16, height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.telegram),
                      ),
                      const SizedBox(width: 8),
                      const Text('Ожидание...', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                    ]),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () => launchUrl(
                          Uri.parse('https://t.me/$_botUsername?start=$_code'),
                          mode: LaunchMode.externalApplication,
                        ),
                        icon: const Icon(Icons.telegram, size: 18),
                        label: Text('Открыть @$_botUsername'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.telegram,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],

                  if (_status == 'expired' || _status == 'error') ...[
                    Text(_error ?? 'Код истёк', style: const TextStyle(color: AppColors.error, fontSize: 14)),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: _initTelegram,
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text('Получить новый код'),
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.surfaceBorder),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
