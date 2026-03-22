class ApiConstants {
  static const String baseUrl = 'https://app.aifuturenow.ru/api';

  // Auth
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String me = '/auth/me';
  static const String setPassword = '/auth/set-password';

  // OAuth
  static const String oauthConfig = '/auth/oauth/config';
  static const String oauthGoogle = '/auth/oauth/google';
  static const String oauthApple = '/auth/oauth/apple';

  // Telegram
  static const String telegramInit = '/auth/telegram/init';
  static String telegramPoll(String code) => '/auth/telegram/poll/$code';
  static const String telegramLinkInit = '/auth/telegram/link/init';
  static String telegramLinkPoll(String code) => '/auth/telegram/link/poll/$code';
  static const String telegramUnlink = '/auth/telegram/unlink';

  // Chat
  static const String chatStream = '/chat/stream';

  // Conversations
  static const String conversations = '/conversations';
  static String conversation(String id) => '/conversations/$id';
  static String messages(String id) => '/conversations/$id/messages';
  static const String searchMessages = '/conversations/search/query';

  // Models
  static const String models = '/models';
  static const String modelKeys = '/models/keys';
  static String modelKey(String provider) => '/models/keys/$provider';

  // Files
  static const String fileUpload = '/files/upload';

  // Settings
  static const String settings = '/settings';

  // Admin
  static const String adminStats = '/admin/stats';
  static const String adminUsers = '/admin/users';
  static String adminUserRole(String id) => '/admin/users/$id/role';
  static String adminUserBlock(String id) => '/admin/users/$id/block';
  static String adminUserPassword(String id) => '/admin/users/$id/password';
  static String adminUserDelete(String id) => '/admin/users/$id';
  static const String adminGlobalKeys = '/admin/global-keys';
  static String adminGlobalKey(String provider) => '/admin/global-keys/$provider';
  static const String adminTopup = '/admin/balance/topup';
  static const String adminTransactions = '/admin/balance/transactions';
  static const String adminPricing = '/admin/pricing';

  // Folders
  static const String folders = '/folders';
  static String folder(String id) => '/folders/$id';

  // Prompt Templates
  static const String promptTemplates = '/prompt-templates';
  static String promptTemplate(String id) => '/prompt-templates/$id';

  // Sharing
  static String shareConversation(String convId) => '/share/$convId';
  static String shareStatus(String convId) => '/share/status/$convId';
  static String sharePublic(String shareId) => '/share/public/$shareId';

  // Export
  static String exportConversation(String convId) => '/conversations/$convId/export';

  // Message delete
  static String deleteMessage(String convId, String msgId) => '/conversations/$convId/messages/$msgId';
}
