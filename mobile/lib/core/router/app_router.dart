import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';
import '../../presentation/screens/splash/splash_screen.dart';
import '../../presentation/screens/auth/auth_screen.dart';
import '../../presentation/screens/auth/email_login_screen.dart';
import '../../presentation/screens/auth/telegram_auth_screen.dart';
import '../../presentation/screens/home/home_screen.dart';
import '../../presentation/screens/settings/settings_screen.dart';
import '../../presentation/screens/profile/profile_screen.dart';
import '../../presentation/screens/search/search_screen.dart';
import '../../presentation/screens/system_prompt/system_prompt_screen.dart';
import '../../presentation/screens/admin/admin_screen.dart';
import '../../presentation/screens/settings/prompt_templates_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final loggedIn = authState.user != null;
      final isSplash = state.matchedLocation == '/splash';
      final isAuth = state.matchedLocation.startsWith('/auth');

      if (isSplash) return null;
      if (!loggedIn && !isAuth) return '/auth';
      if (loggedIn && isAuth) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/auth', builder: (_, __) => const AuthScreen(),
        routes: [
          GoRoute(path: 'email', builder: (_, __) => const EmailLoginScreen()),
          GoRoute(path: 'telegram', builder: (_, __) => const TelegramAuthScreen()),
        ],
      ),
      GoRoute(path: '/', builder: (_, __) => const HomeScreen(),
        routes: [
          GoRoute(path: 'settings', builder: (_, __) => const SettingsScreen()),
          GoRoute(path: 'profile', builder: (_, __) => const ProfileScreen()),
          GoRoute(path: 'search', builder: (_, __) => const SearchScreen()),
          GoRoute(path: 'system-prompt', builder: (_, __) => const SystemPromptScreen()),
          GoRoute(path: 'admin', builder: (_, __) => const AdminScreen()),
          GoRoute(path: 'prompt-templates', builder: (_, __) => const PromptTemplatesScreen()),
        ],
      ),
    ],
  );
});
