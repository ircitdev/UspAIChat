class User {
  final String id;
  final String? email;
  final String username;
  final String role;
  final int isBlocked;
  final double balance;
  final String? avatar;
  final int? telegramId;
  final String? telegramUsername;
  final String? googleId;
  final String? appleId;
  final int createdAt;
  final bool? hasPassword;
  final String? referralCode;
  final double referralEarnings;

  User({
    required this.id,
    this.email,
    required this.username,
    required this.role,
    this.isBlocked = 0,
    this.balance = 0,
    this.avatar,
    this.telegramId,
    this.telegramUsername,
    this.googleId,
    this.appleId,
    required this.createdAt,
    this.hasPassword,
    this.referralCode,
    this.referralEarnings = 0,
  });

  bool get isAdmin => role == 'admin';
  bool get isBlockedUser => isBlocked == 1;

  factory User.fromJson(Map<String, dynamic> json) => User(
    id: json['id'] as String,
    email: json['email'] as String?,
    username: json['username'] as String,
    role: json['role'] as String? ?? 'user',
    isBlocked: json['is_blocked'] as int? ?? 0,
    balance: (json['balance'] as num?)?.toDouble() ?? 0,
    avatar: json['avatar'] as String?,
    telegramId: json['telegram_id'] as int?,
    telegramUsername: json['telegram_username'] as String?,
    googleId: json['google_id'] as String?,
    appleId: json['apple_id'] as String?,
    createdAt: json['created_at'] as int,
    hasPassword: json['has_password'] as bool?,
    referralCode: json['referral_code'] as String?,
    referralEarnings: (json['referral_earnings'] as num?)?.toDouble() ?? 0,
  );

  User copyWith({double? balance, int? telegramId, String? telegramUsername, bool? hasPassword, double? referralEarnings, String? googleId, bool clearGoogleId = false, String? appleId, bool clearAppleId = false}) => User(
    id: id,
    email: email,
    username: username,
    role: role,
    isBlocked: isBlocked,
    balance: balance ?? this.balance,
    avatar: avatar,
    telegramId: telegramId ?? this.telegramId,
    telegramUsername: telegramUsername ?? this.telegramUsername,
    googleId: clearGoogleId ? null : (googleId ?? this.googleId),
    appleId: clearAppleId ? null : (appleId ?? this.appleId),
    createdAt: createdAt,
    hasPassword: hasPassword ?? this.hasPassword,
    referralCode: referralCode,
    referralEarnings: referralEarnings ?? this.referralEarnings,
  );
}
