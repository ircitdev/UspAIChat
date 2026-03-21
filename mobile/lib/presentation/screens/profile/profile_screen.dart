import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/datasources/remote/auth_api.dart';
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
