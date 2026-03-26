import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/auth_provider.dart';

class AuthScreen extends ConsumerWidget {
  const AuthScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Logo
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AppColors.violet600, AppColors.purple800],
                    ),
                    boxShadow: [BoxShadow(color: AppColors.violet600.withOpacity(0.3), blurRadius: 20)],
                  ),
                  child: const Icon(Icons.smart_toy, color: Colors.white, size: 30),
                ),
                const SizedBox(height: 12),
                const Text('UspAIChat',
                  style: TextStyle(color: AppColors.textPrimary, fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                const Text('Добро пожаловать!',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 14),
                ),
                const SizedBox(height: 32),

                // Card
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.cardBorder),
                  ),
                  child: Column(
                    children: [
                      // Google
                      _OAuthButton(
                        onPressed: auth.loading ? null : () => ref.read(authProvider.notifier).loginWithGoogle(),
                        icon: Icons.g_mobiledata,
                        label: 'Войти через Google',
                        backgroundColor: Colors.white,
                        textColor: Colors.black87,
                      ),
                      const SizedBox(height: 10),

                      // Apple (iOS only — Android has no native Apple Sign-In)
                      if (Platform.isIOS) ...[
                        _OAuthButton(
                          onPressed: auth.loading ? null : () => ref.read(authProvider.notifier).loginWithApple(),
                          icon: Icons.apple,
                          label: 'Войти через Apple',
                          backgroundColor: Colors.white,
                          textColor: Colors.black87,
                        ),
                        const SizedBox(height: 10),
                      ],

                      // Telegram
                      _OAuthButton(
                        onPressed: auth.loading ? null : () => context.go('/auth/telegram'),
                        icon: Icons.telegram,
                        label: 'Войти через Telegram',
                        backgroundColor: AppColors.telegram,
                        textColor: Colors.white,
                      ),
                      const SizedBox(height: 16),

                      // Divider
                      Row(children: [
                        const Expanded(child: Divider(color: AppColors.cardBorder)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text('или', style: TextStyle(color: AppColors.textDim, fontSize: 12)),
                        ),
                        const Expanded(child: Divider(color: AppColors.cardBorder)),
                      ]),
                      const SizedBox(height: 16),

                      // Email login
                      _OAuthButton(
                        onPressed: () => context.go('/auth/email'),
                        icon: Icons.email_outlined,
                        label: 'Войти по email',
                        backgroundColor: AppColors.surfaceBorder,
                        textColor: AppColors.textSecondary,
                        borderColor: AppColors.cardBorder,
                      ),

                      if (auth.error != null) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.error.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.error.withOpacity(0.2)),
                          ),
                          child: Text(auth.error!, style: const TextStyle(color: AppColors.error, fontSize: 12)),
                        ),
                      ],

                      if (auth.loading) ...[
                        const SizedBox(height: 16),
                        const SizedBox(width: 20, height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.violet600),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Данные синхронизируются между устройствами',
                  style: TextStyle(color: AppColors.textDim, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OAuthButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final IconData icon;
  final String label;
  final Color backgroundColor;
  final Color textColor;
  final Color? borderColor;

  const _OAuthButton({
    required this.onPressed,
    required this.icon,
    required this.label,
    required this.backgroundColor,
    required this.textColor,
    this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 20, color: textColor),
        label: Text(label, style: TextStyle(color: textColor, fontWeight: FontWeight.w600)),
        style: ElevatedButton.styleFrom(
          backgroundColor: backgroundColor,
          foregroundColor: textColor,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
            side: borderColor != null ? BorderSide(color: borderColor!) : BorderSide.none,
          ),
          padding: const EdgeInsets.symmetric(vertical: 14),
          elevation: 0,
        ),
      ),
    );
  }
}
