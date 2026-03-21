import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import '../data/datasources/remote/api_client.dart';
import '../data/datasources/remote/auth_api.dart';
import '../data/models/user_model.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());
final authApiProvider = Provider<AuthApi>((ref) => AuthApi(ref.read(apiClientProvider)));

class AuthState {
  final User? user;
  final bool loading;
  final String? error;

  AuthState({this.user, this.loading = false, this.error});

  AuthState copyWith({User? user, bool? loading, String? error, bool clearUser = false, bool clearError = false}) =>
      AuthState(
        user: clearUser ? null : (user ?? this.user),
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _client;
  final AuthApi _api;

  AuthNotifier(this._client, this._api) : super(AuthState());

  Future<bool> restoreSession() async {
    state = state.copyWith(loading: true);
    try {
      final user = await _client.restoreSession();
      if (user != null) {
        state = AuthState(user: user);
        return true;
      }
      state = AuthState();
      return false;
    } catch (_) {
      state = AuthState();
      return false;
    }
  }

  Future<void> _handleAuth(Future<AuthResult> Function() authFn) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final result = await authFn();
      await _client.saveTokens(result.accessToken, result.refreshToken);
      state = AuthState(user: result.user);
    } catch (e) {
      final msg = _extractError(e);
      state = state.copyWith(loading: false, error: msg);
    }
  }

  Future<void> login(String email, String password) =>
      _handleAuth(() => _api.login(email, password));

  Future<void> register(String email, String username, String password) =>
      _handleAuth(() => _api.register(email, username, password));

  Future<void> loginWithGoogle() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final config = await _api.getOAuthConfig();
      final clientId = config['google_client_id'];
      if (clientId == null) throw Exception('Google Sign-In not configured');

      final googleSignIn = GoogleSignIn(serverClientId: clientId);
      final account = await googleSignIn.signIn();
      if (account == null) {
        state = state.copyWith(loading: false);
        return;
      }
      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) throw Exception('Failed to get Google ID token');

      await _handleAuth(() => _api.loginWithGoogle(idToken));
    } catch (e) {
      state = state.copyWith(loading: false, error: _extractError(e));
    }
  }

  Future<void> loginWithApple() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
      );
      final idToken = credential.identityToken;
      if (idToken == null) throw Exception('Failed to get Apple ID token');

      Map<String, dynamic>? user;
      if (credential.givenName != null || credential.email != null) {
        user = {
          'name': {
            'firstName': credential.givenName ?? '',
            'lastName': credential.familyName ?? '',
          },
          'email': credential.email,
        };
      }

      await _handleAuth(() => _api.loginWithApple(idToken, user: user));
    } catch (e) {
      state = state.copyWith(loading: false, error: _extractError(e));
    }
  }

  Future<void> logout() async {
    await _api.logout();
    state = AuthState();
  }

  void updateBalance(double balance) {
    if (state.user != null) {
      state = state.copyWith(user: state.user!.copyWith(balance: balance));
    }
  }

  void updateUser(User user) {
    state = state.copyWith(user: user);
  }

  void clearError() => state = state.copyWith(clearError: true);

  String _extractError(dynamic e) {
    if (e is DioException && e.response?.data is Map) {
      return e.response!.data['error'] as String? ?? 'Error';
    }
    return e.toString();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final client = ref.read(apiClientProvider);
  final api = ref.read(authApiProvider);
  return AuthNotifier(client, api);
});
