import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../models/user_model.dart';
import 'api_client.dart';

class AuthResult {
  final User user;
  final String accessToken;
  final String refreshToken;

  AuthResult({required this.user, required this.accessToken, required this.refreshToken});

  factory AuthResult.fromJson(Map<String, dynamic> json) => AuthResult(
    user: User.fromJson(json['user']),
    accessToken: json['accessToken'] as String,
    refreshToken: json['refreshToken'] as String,
  );
}

class AuthApi {
  final ApiClient _client;
  Dio get _dio => _client.dio;

  AuthApi(this._client);

  Future<AuthResult> login(String email, String password) async {
    final response = await _dio.post(ApiConstants.login, data: {
      'email': email,
      'password': password,
    });
    return AuthResult.fromJson(response.data);
  }

  Future<AuthResult> register(String email, String username, String password) async {
    final response = await _dio.post(ApiConstants.register, data: {
      'email': email,
      'username': username,
      'password': password,
    });
    return AuthResult.fromJson(response.data);
  }

  Future<AuthResult> loginWithGoogle(String credential) async {
    final response = await _dio.post(ApiConstants.oauthGoogle, data: {
      'credential': credential,
    });
    return AuthResult.fromJson(response.data);
  }

  Future<AuthResult> loginWithApple(String idToken, {Map<String, dynamic>? user}) async {
    final response = await _dio.post(ApiConstants.oauthApple, data: {
      'id_token': idToken,
      if (user != null) 'user': user,
    });
    return AuthResult.fromJson(response.data);
  }

  Future<Map<String, String?>> getOAuthConfig() async {
    final response = await _dio.get(ApiConstants.oauthConfig);
    return {
      'google_client_id': response.data['google_client_id'] as String?,
      'apple_client_id': response.data['apple_client_id'] as String?,
    };
  }

  Future<User> getMe() async {
    final response = await _dio.get(ApiConstants.me);
    return User.fromJson(response.data['user']);
  }

  Future<void> setPassword({String? currentPassword, required String newPassword}) async {
    await _dio.post(ApiConstants.setPassword, data: {
      if (currentPassword != null) 'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

  Future<void> logout() async {
    final refreshToken = await _client.getRefreshToken();
    try {
      await _dio.post(ApiConstants.logout, data: {'refreshToken': refreshToken});
    } catch (_) {}
    await _client.clearTokens();
  }

  // Telegram
  Future<Map<String, dynamic>> telegramInit() async {
    final response = await _dio.post(ApiConstants.telegramInit);
    return response.data;
  }

  Future<Map<String, dynamic>> telegramPoll(String code) async {
    final response = await _dio.get(ApiConstants.telegramPoll(code));
    return response.data;
  }

  Future<Map<String, dynamic>> telegramLinkInit() async {
    final response = await _dio.post(ApiConstants.telegramLinkInit);
    return response.data;
  }

  Future<Map<String, dynamic>> telegramLinkPoll(String code) async {
    final response = await _dio.get(ApiConstants.telegramLinkPoll(code));
    return response.data;
  }

  Future<void> telegramUnlink() async {
    await _dio.delete(ApiConstants.telegramUnlink);
  }

  // Google link/unlink
  Future<User> linkGoogle(String credential) async {
    final response = await _dio.post(ApiConstants.oauthGoogleLink, data: {'credential': credential});
    return User.fromJson(response.data['user']);
  }

  Future<User> unlinkGoogle() async {
    final response = await _dio.delete(ApiConstants.oauthGoogleUnlink);
    return User.fromJson(response.data['user']);
  }

  // Apple link/unlink
  Future<User> linkApple(String idToken) async {
    final response = await _dio.post(ApiConstants.oauthAppleLink, data: {'id_token': idToken});
    return User.fromJson(response.data['user']);
  }

  Future<User> unlinkApple() async {
    final response = await _dio.delete(ApiConstants.oauthAppleUnlink);
    return User.fromJson(response.data['user']);
  }
}
