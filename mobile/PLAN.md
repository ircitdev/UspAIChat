# UspAIChat Mobile — План разработки Flutter-приложения

## Обзор

Мобильное приложение для iOS и Android на Flutter, использующее существующий backend API (`app.aifuturenow.ru`). Полное зеркало функционала веб-версии.

**Bundle ID:** `ru.aifuturenow.uspaichat`
**Оценка:** 25-35 рабочих дней (1 разработчик) / 15-20 дней (команда из 2)
**Итого:** ~18 экранов, ~30 виджетов, ~12 моделей данных, ~8 API-сервисов

---

## Архитектура

- **Паттерн:** Riverpod + Clean Architecture
- **Навигация:** GoRouter
- **HTTP:** Dio с интерцепторами (JWT auto-refresh)
- **SSE стриминг:** Ручной парсинг через Dio `ResponseType.stream`
- **Хранение токенов:** flutter_secure_storage
- **Локализация:** flutter_localizations + ARB (ru, en, zh)

---

## Зависимости (pubspec.yaml)

```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter

  # Состояние
  flutter_riverpod: ^2.5.1
  riverpod_annotation: ^2.3.5

  # Навигация
  go_router: ^14.2.0

  # Сеть
  dio: ^5.4.3+1

  # Аутентификация
  google_sign_in: ^6.2.1
  sign_in_with_apple: ^6.1.0
  flutter_secure_storage: ^9.2.2
  url_launcher: ^6.2.5

  # UI
  flutter_markdown: ^0.7.1
  flutter_highlight: ^0.7.0
  cached_network_image: ^3.3.1
  shimmer: ^3.0.0
  flutter_animate: ^4.5.0
  flutter_svg: ^2.0.10+1

  # Файлы
  image_picker: ^1.0.7
  file_picker: ^8.0.3
  permission_handler: ^11.3.1
  mime: ^1.0.5

  # Локализация
  intl: ^0.19.0

  # Хранение
  shared_preferences: ^2.2.3
  hive_flutter: ^1.1.0

  # Push (опционально)
  firebase_core: ^2.27.1
  firebase_messaging: ^14.7.19

  # Утилиты
  uuid: ^4.3.3
  timeago: ^3.6.1
  share_plus: ^9.0.0
  connectivity_plus: ^6.0.3
  json_annotation: ^4.9.0

dev_dependencies:
  build_runner: ^2.4.9
  riverpod_generator: ^2.4.0
  json_serializable: ^6.8.0
  flutter_launcher_icons: ^0.13.1
  flutter_native_splash: ^2.4.0
```

---

## Структура проекта

```
mobile/
├── android/
├── ios/
├── lib/
│   ├── main.dart
│   ├── app.dart                           # MaterialApp + GoRouter + ProviderScope
│   │
│   ├── core/
│   │   ├── constants/
│   │   │   ├── api_constants.dart         # BASE_URL, эндпоинты
│   │   │   ├── app_colors.dart            # Цветовая палитра
│   │   │   └── app_strings.dart
│   │   ├── theme/
│   │   │   ├── app_theme.dart             # ThemeData (dark)
│   │   │   └── text_styles.dart
│   │   ├── router/
│   │   │   └── app_router.dart            # GoRouter
│   │   ├── utils/
│   │   │   ├── date_utils.dart
│   │   │   ├── file_utils.dart
│   │   │   └── validators.dart
│   │   └── extensions/
│   │       └── context_extensions.dart
│   │
│   ├── data/
│   │   ├── datasources/
│   │   │   ├── remote/
│   │   │   │   ├── api_client.dart        # Dio + интерцепторы
│   │   │   │   ├── auth_api.dart
│   │   │   │   ├── chat_api.dart          # SSE стриминг
│   │   │   │   ├── conversation_api.dart
│   │   │   │   ├── model_api.dart
│   │   │   │   ├── file_api.dart
│   │   │   │   ├── admin_api.dart
│   │   │   │   └── settings_api.dart
│   │   │   └── local/
│   │   │       ├── secure_storage.dart
│   │   │       └── preferences.dart
│   │   ├── models/
│   │   │   ├── user_model.dart
│   │   │   ├── conversation_model.dart
│   │   │   ├── message_model.dart
│   │   │   ├── file_attachment_model.dart
│   │   │   ├── model_info_model.dart
│   │   │   ├── api_key_status_model.dart
│   │   │   ├── search_result_model.dart
│   │   │   ├── auth_tokens_model.dart
│   │   │   ├── admin_stats_model.dart
│   │   │   ├── transaction_model.dart
│   │   │   └── sse_event_model.dart
│   │   └── repositories/
│   │       ├── auth_repository_impl.dart
│   │       ├── chat_repository_impl.dart
│   │       ├── conversation_repository_impl.dart
│   │       ├── model_repository_impl.dart
│   │       ├── file_repository_impl.dart
│   │       └── admin_repository_impl.dart
│   │
│   ├── domain/
│   │   └── repositories/
│   │       ├── auth_repository.dart
│   │       ├── chat_repository.dart
│   │       ├── conversation_repository.dart
│   │       ├── model_repository.dart
│   │       ├── file_repository.dart
│   │       └── admin_repository.dart
│   │
│   ├── providers/
│   │   ├── auth_provider.dart
│   │   ├── conversation_provider.dart
│   │   ├── chat_provider.dart
│   │   ├── model_provider.dart
│   │   ├── settings_provider.dart
│   │   ├── admin_provider.dart
│   │   └── connectivity_provider.dart
│   │
│   ├── presentation/
│   │   ├── screens/
│   │   │   ├── splash/
│   │   │   │   └── splash_screen.dart
│   │   │   ├── auth/
│   │   │   │   ├── auth_screen.dart
│   │   │   │   ├── email_login_screen.dart
│   │   │   │   └── telegram_auth_screen.dart
│   │   │   ├── home/
│   │   │   │   └── home_screen.dart
│   │   │   ├── chat/
│   │   │   │   ├── chat_screen.dart
│   │   │   │   └── empty_chat_screen.dart
│   │   │   ├── conversations/
│   │   │   │   └── conversations_list.dart
│   │   │   ├── search/
│   │   │   │   └── search_screen.dart
│   │   │   ├── settings/
│   │   │   │   ├── settings_screen.dart
│   │   │   │   ├── api_keys_section.dart
│   │   │   │   └── language_section.dart
│   │   │   ├── profile/
│   │   │   │   ├── profile_screen.dart
│   │   │   │   ├── password_section.dart
│   │   │   │   └── telegram_link_section.dart
│   │   │   ├── system_prompt/
│   │   │   │   └── system_prompt_screen.dart
│   │   │   └── admin/
│   │   │       ├── admin_screen.dart
│   │   │       ├── admin_stats_tab.dart
│   │   │       ├── admin_users_tab.dart
│   │   │       ├── admin_balance_tab.dart
│   │   │       └── admin_keys_tab.dart
│   │   │
│   │   └── widgets/
│   │       ├── common/
│   │       │   ├── app_button.dart
│   │       │   ├── app_text_field.dart
│   │       │   ├── app_loading.dart
│   │       │   ├── error_banner.dart
│   │       │   └── avatar_widget.dart
│   │       ├── chat/
│   │       │   ├── message_bubble.dart
│   │       │   ├── streaming_bubble.dart
│   │       │   ├── chat_input_bar.dart
│   │       │   ├── model_selector_bar.dart
│   │       │   ├── file_preview_chips.dart
│   │       │   ├── code_block.dart
│   │       │   └── markdown_body.dart
│   │       ├── conversation/
│   │       │   ├── conversation_tile.dart
│   │       │   └── conversation_actions.dart
│   │       └── auth/
│   │           ├── google_sign_in_button.dart
│   │           ├── apple_sign_in_button.dart
│   │           └── telegram_code_display.dart
│   │
│   └── l10n/
│       ├── app_en.arb
│       ├── app_ru.arb
│       └── app_zh.arb
│
├── assets/
│   ├── images/
│   │   └── logo.png
│   └── icons/
│       ├── google.svg
│       ├── apple.svg
│       └── telegram.svg
│
├── test/
├── pubspec.yaml
└── README.md
```

---

## Цветовая палитра (из веб-версии)

```dart
class AppColors {
  static const background    = Color(0xFF0D0D1A);  // bg
  static const surface       = Color(0xFF111122);  // cards
  static const surfaceLight  = Color(0xFF1A1A2E);  // inputs
  static const surfaceBorder = Color(0xFF1E1E2E);  // borders
  static const cardBorder    = Color(0xFF2D2D3F);  // card borders

  static const textPrimary   = Color(0xFFF1F5F9);  // slate-100
  static const textSecondary = Color(0xFF94A3B8);  // slate-400
  static const textMuted     = Color(0xFF64748B);  // slate-500
  static const textDim       = Color(0xFF475569);  // slate-600

  static const violet600     = Color(0xFF7C3AED);  // primary
  static const violet700     = Color(0xFF6D28D9);  // primary hover

  // Провайдеры
  static const orange400     = Color(0xFFFB923C);  // Anthropic
  static const green400      = Color(0xFF4ADE80);  // OpenAI
  static const blue400       = Color(0xFF60A5FA);  // Gemini
  static const cyan400       = Color(0xFF22D3EE);  // DeepSeek
  static const purple400     = Color(0xFFC084FC);  // Kimi

  static const telegram      = Color(0xFF2AABEE);
  static const error         = Color(0xFFF87171);
  static const success       = Color(0xFF4ADE80);
}
```

---

## Модели данных (Dart)

### User

```dart
@JsonSerializable()
class User {
  final String id;
  final String? email;
  final String username;
  final String role;           // 'admin' | 'user'
  final int isBlocked;
  final double balance;
  final String? avatar;
  final int? telegramId;
  final String? telegramUsername;
  final String? googleId;
  final String? appleId;
  final int createdAt;
  final bool? hasPassword;
}
```

### Conversation

```dart
@JsonSerializable()
class Conversation {
  final String id;
  final String title;
  final String provider;
  final String model;
  final String systemPrompt;
  final int createdAt;
  final int updatedAt;
  final int tokenCount;
  final int isPinned;
  final String? lastMessage;
  final int? messageCount;
}
```

### Message

```dart
@JsonSerializable()
class Message {
  final String id;
  final String conversationId;
  final String role;            // 'user' | 'assistant' | 'system'
  final String content;
  final int createdAt;
  final int tokenCount;
  final String? provider;
  final String? model;
  final List<FileAttachment> files;
}
```

### SSE Events

```dart
sealed class SseEvent {}
class SseStart extends SseEvent { final String messageId; }
class SseChunk extends SseEvent { final String content; }
class SseTokens extends SseEvent { final int count; }
class SsePrice extends SseEvent { final double pricePer1k; }
class SseDone extends SseEvent {
  final String messageId;
  final String fullContent;
  final double? balanceAfter;
}
class SseError extends SseEvent { final String error; }
```

---

## API-эндпоинты (полный реестр)

### Аутентификация

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/auth/login` | Вход email/пароль |
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/refresh` | Обновить токены |
| POST | `/api/auth/logout` | Выход |
| GET | `/api/auth/me` | Текущий пользователь |
| POST | `/api/auth/set-password` | Установить/сменить пароль |

### OAuth

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/auth/oauth/config` | Client IDs (Google/Apple) |
| POST | `/api/auth/oauth/google` | Вход Google (credential) |
| POST | `/api/auth/oauth/apple` | Вход Apple (id_token) |

### Telegram

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/auth/telegram/init` | Получить 6-значный код |
| GET | `/api/auth/telegram/poll/:code` | Поллинг статуса |
| POST | `/api/auth/telegram/link/init` | Привязать Telegram |
| GET | `/api/auth/telegram/link/poll/:code` | Поллинг привязки |
| DELETE | `/api/auth/telegram/unlink` | Отвязать |

### Чат

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/chat/stream` | SSE стриминг ответа AI |

### Беседы

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/conversations` | Список бесед |
| POST | `/api/conversations` | Создать |
| PUT | `/api/conversations/:id` | Обновить |
| DELETE | `/api/conversations/:id` | Удалить |
| GET | `/api/conversations/:id/messages` | Сообщения |
| GET | `/api/conversations/search/query?q=` | FTS поиск |

### Модели

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/models` | Все модели |
| GET | `/api/models/keys` | Статус ключей |
| POST | `/api/models/keys` | Сохранить ключ |
| DELETE | `/api/models/keys/:provider` | Удалить ключ |

### Файлы

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/files/upload` | Загрузка (до 10 файлов, 50МБ) |

### Админ (role=admin)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/admin/stats` | Статистика |
| GET | `/api/admin/users` | Пользователи |
| PATCH | `/api/admin/users/:id/role` | Роль |
| PATCH | `/api/admin/users/:id/block` | Блокировка |
| PATCH | `/api/admin/users/:id/password` | Сброс пароля |
| DELETE | `/api/admin/users/:id` | Удалить |
| GET/POST/DELETE | `/api/admin/global-keys` | Глобальные ключи |
| POST | `/api/admin/balance/topup` | Пополнить баланс |
| GET | `/api/admin/balance/transactions` | Транзакции |

---

## Экраны приложения

| # | Экран | Описание |
|---|-------|----------|
| 1 | SplashScreen | Логотип + восстановление сессии |
| 2 | AuthScreen | Кнопки Google, Apple, Telegram, Email |
| 3 | EmailLoginScreen | Форма email + пароль |
| 4 | TelegramAuthScreen | 6-значный код + deep-link + таймер |
| 5 | HomeScreen | Scaffold + Drawer + навигация |
| 6 | ChatScreen | Сообщения + стриминг + ввод |
| 7 | EmptyChatScreen | Логотип + "Начните новый чат" |
| 8 | ConversationsList | Drawer: список бесед, swipe-действия |
| 9 | SearchScreen | FTS поиск с debounce |
| 10 | SettingsScreen | API-ключи, язык, о приложении |
| 11 | ProfileScreen | Аватар, пароль, Telegram |
| 12 | SystemPromptScreen | Пресеты + редактор |
| 13 | AdminScreen | Статистика, пользователи, баланс, ключи |

---

## Потоки аутентификации (мобильная реализация)

### Google Sign-In (нативный)

```
GoogleSignIn(serverClientId: googleClientId).signIn()
  → получить idToken из GoogleSignInAuthentication
  → POST /api/auth/oauth/google { credential: idToken }
  → получить { user, accessToken, refreshToken }
  → сохранить в secure storage
```

Настройка:
- Android: добавить SHA-1 в Google Cloud Console, скачать google-services.json
- iOS: добавить GoogleService-Info.plist, URL scheme в Info.plist

### Apple Sign-In (нативный)

```
SignInWithApple.getAppleIDCredential(scopes: [name, email])
  → получить identityToken
  → POST /api/auth/oauth/apple { id_token: identityToken, user: {...} }
  → получить { user, accessToken, refreshToken }
```

Настройка:
- iOS: включить Sign In with Apple в Capabilities
- Android: через веб-авторизацию (redirect URI)
- Apple Developer: настроить App ID, Service ID

### Telegram (код через бота)

```
POST /api/auth/telegram/init → { code, bot_username, expires_in }
  → показать код + кнопка "Открыть бот"
  → url_launcher: tg://resolve?domain=bot&start=code
  → Timer.periodic(2s): GET /api/auth/telegram/poll/code
  → status == 'confirmed' → получить токены
```

### Auto-refresh токенов

```
Timer.periodic(12 минут):
  → POST /api/auth/refresh { refreshToken }
  → обновить secure storage
  → обновить Dio headers
```

---

## SSE-стриминг чата

```dart
Future<void> streamChat({
  required String conversationId,
  required String message,
  required String provider,
  required String model,
  String? systemPrompt,
  List<Map>? files,
  required void Function(SseEvent) onEvent,
}) async {
  final response = await dio.post(
    '/chat/stream',
    data: { ... },
    options: Options(responseType: ResponseType.stream),
  );

  final stream = response.data.stream as Stream<List<int>>;
  String buffer = '';

  await for (final bytes in stream) {
    buffer += utf8.decode(bytes);
    final lines = buffer.split('\n');
    buffer = lines.removeLast();

    for (final line in lines) {
      if (line.startsWith('data: ')) {
        final json = jsonDecode(line.substring(6));
        onEvent(_parseSseEvent(json));
      }
    }
  }
}
```

---

## Фазы разработки

### Фаза 1: Скелет проекта (2-3 дня)

- [ ] `flutter create --org ru.aifuturenow uspaichat_mobile`
- [ ] Настройка pubspec.yaml
- [ ] Создание структуры папок
- [ ] Настройка AppTheme (dark-only)
- [ ] Настройка GoRouter
- [ ] Настройка ProviderScope
- [ ] Настройка l10n (ru, en, zh)

### Фаза 2: API-слой и модели (3-4 дня)

- [ ] Все data-модели с json_serializable
- [ ] Dio-клиент с base URL
- [ ] AuthInterceptor (JWT + auto-refresh при 401)
- [ ] SecureStorage для токенов
- [ ] AuthApi, OAuthApi, TelegramAuthApi
- [ ] ConversationApi, ModelApi, ChatApi (SSE)
- [ ] FileApi, AdminApi, SettingsApi
- [ ] build_runner для кодогенерации

### Фаза 3: Аутентификация (4-5 дней)

- [ ] SplashScreen + restoreSession()
- [ ] AuthProvider (Riverpod StateNotifier)
- [ ] AuthScreen с кнопками OAuth
- [ ] Google Sign-In: google-services.json, GoogleService-Info.plist
- [ ] Apple Sign-In: capabilities, Service ID
- [ ] EmailLoginScreen
- [ ] TelegramAuthScreen (код, deep-link, поллинг, таймер)
- [ ] Auto-refresh (12 минут)

### Фаза 4: Основной чат (5-6 дней)

- [ ] ConversationProvider
- [ ] HomeScreen + Drawer
- [ ] ConversationsList с Slidable (pin, delete, rename)
- [ ] EmptyChatScreen
- [ ] ChatScreen + MessageBubble (user/assistant)
- [ ] MarkdownBody + CodeBlock (подсветка, Copy)
- [ ] ChatInputBar
- [ ] StreamingBubble (анимация курсора)
- [ ] SSE интеграция
- [ ] ModelSelectorBar (провайдер + модель)
- [ ] Обновление баланса после ответа

### Фаза 5: Файлы (2-3 дня)

- [ ] image_picker (камера + галерея)
- [ ] file_picker (PDF, DOCX, TXT, ...)
- [ ] permission_handler
- [ ] FilePreviewChips
- [ ] Отображение файлов в MessageBubble
- [ ] Multipart upload

### Фаза 6: Промпт и поиск (1-2 дня)

- [ ] SystemPromptScreen + пресеты
- [ ] SearchScreen с debounce

### Фаза 7: Профиль и настройки (2-3 дня)

- [ ] ProfileScreen
- [ ] PasswordSection (установка/смена)
- [ ] TelegramLinkSection (привязка/отвязка)
- [ ] SettingsScreen
- [ ] ApiKeysSection (CRUD по провайдерам)
- [ ] LanguageSection (ru/en/zh)

### Фаза 8: Админ-панель (3-4 дня)

- [ ] AdminScreen + TabBar
- [ ] AdminStatsTab
- [ ] AdminUsersTab (поиск, роли, блокировка, сброс, удаление)
- [ ] AdminBalanceTab (пополнение + история)
- [ ] AdminKeysTab (глобальные ключи)

### Фаза 9: Push-уведомления (2-3 дня, опционально)

- [ ] Firebase FCM для Android/iOS
- [ ] Запрос разрешений
- [ ] Device token на бэкенд (нужен новый endpoint)
- [ ] Обработка уведомлений (foreground/background)
- [ ] Deep-link к беседе

### Фаза 10: Полировка и публикация (3-4 дня)

- [ ] Splash screen (flutter_native_splash)
- [ ] App icon (flutter_launcher_icons)
- [ ] Haptic feedback
- [ ] Pull-to-refresh
- [ ] Обработка offline (connectivity_plus)
- [ ] Анимации переходов
- [ ] Тестирование (phone/tablet)
- [ ] Performance-оптимизация
- [ ] Release APK/IPA
- [ ] Google Play (Internal Testing)
- [ ] App Store (TestFlight)

---

## Настройка для публикации

### Android (Google Play)

1. Создать release keystore: `keytool -genkey -v -keystore upload-keystore.jks`
2. `build.gradle`: minSdk 23, targetSdk 34, compileSdk 34
3. Добавить `google-services.json`
4. Permissions: INTERNET, CAMERA, READ_EXTERNAL_STORAGE
5. Сборка: `flutter build appbundle --release`
6. Google Play Console: Internal Testing → Closed Beta → Production

### iOS (App Store)

1. Apple Developer Account ($99/год)
2. Capabilities: Sign In with Apple, Push Notifications
3. Provisioning Profile (Distribution)
4. Info.plist: NSCameraUsageDescription, NSPhotoLibraryUsageDescription
5. Сборка: `flutter build ipa --release`
6. App Store Connect: TestFlight → Review → Release

---

## Критически важные файлы для реализации

При разработке обязательно изучить эти файлы веб-версии:

| Файл | Зачем |
|------|-------|
| `backend/src/routes/chat.js` | SSE протокол: формат событий |
| `backend/src/routes/authOAuth.js` | Google/Apple API: формат запросов |
| `frontend/src/types/index.ts` | TypeScript-интерфейсы → Dart-модели |
| `frontend/src/store/authStore.ts` | Логика сессий и auto-refresh |
| `frontend/src/services/api.ts` | SSE парсинг, Axios интерцепторы |
| `frontend/src/components/AuthScreen.tsx` | Все потоки авторизации |
| `frontend/src/components/ChatWindow.tsx` | Стриминг UI |
