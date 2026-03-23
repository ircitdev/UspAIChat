import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'providers/theme_provider.dart';

class UspAIChatApp extends ConsumerWidget {
  const UspAIChatApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final themeNotifier = ref.watch(themeProvider.notifier);

    return MaterialApp.router(
      title: 'UspAIChat',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeNotifier.themeMode,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
