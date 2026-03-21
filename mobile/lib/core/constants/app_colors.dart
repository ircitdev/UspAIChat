import 'package:flutter/material.dart';

class AppColors {
  static const background = Color(0xFF0D0D1A);
  static const surface = Color(0xFF111122);
  static const surfaceLight = Color(0xFF1A1A2E);
  static const surfaceBorder = Color(0xFF1E1E2E);
  static const cardBorder = Color(0xFF2D2D3F);

  static const textPrimary = Color(0xFFF1F5F9);
  static const textSecondary = Color(0xFF94A3B8);
  static const textMuted = Color(0xFF64748B);
  static const textDim = Color(0xFF475569);

  static const violet600 = Color(0xFF7C3AED);
  static const violet700 = Color(0xFF6D28D9);
  static const violet400 = Color(0xFFA78BFA);
  static const purple800 = Color(0xFF6B21A8);

  // Provider colors
  static const anthropic = Color(0xFFFB923C);
  static const openai = Color(0xFF4ADE80);
  static const gemini = Color(0xFF60A5FA);
  static const deepseek = Color(0xFF22D3EE);
  static const kimi = Color(0xFFC084FC);

  static const telegram = Color(0xFF2AABEE);
  static const google = Color(0xFF4285F4);
  static const apple = Color(0xFFFFFFFF);

  static const error = Color(0xFFF87171);
  static const success = Color(0xFF4ADE80);
  static const warning = Color(0xFFFBBF24);

  static Color providerColor(String provider) {
    switch (provider) {
      case 'anthropic': return anthropic;
      case 'openai': return openai;
      case 'gemini': return gemini;
      case 'deepseek': return deepseek;
      case 'kimi': return kimi;
      default: return violet600;
    }
  }
}
