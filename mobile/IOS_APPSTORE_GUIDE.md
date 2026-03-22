# iOS App Store Publication Guide — UspAIChat

## Prerequisites on Mac

```bash
# 1. Install Xcode from Mac App Store (version 15+)
# 2. Install Xcode command line tools
xcode-select --install

# 3. Install Flutter (if not installed)
git clone https://github.com/flutter/flutter.git -b stable ~/flutter
export PATH="$HOME/flutter/bin:$PATH"
flutter doctor

# 4. Install CocoaPods
sudo gem install cocoapods
# or via Homebrew:
brew install cocoapods
```

## Step 1: Clone the project

```bash
git clone https://github.com/ircitdev/UspAIChat.git
cd UspAIChat/mobile
flutter pub get
cd ios && pod install && cd ..
```

## Step 2: Configure signing

1. Open `ios/Runner.xcworkspace` in Xcode
2. Select the **Runner** target
3. Go to **Signing & Capabilities** tab
4. Select your **Team** (Apple Developer account)
5. Set **Bundle Identifier**: `ru.aifuturenow.uspaichat`
6. Xcode will auto-create provisioning profiles

Or via command line:
```bash
# Install fastlane (recommended)
gem install fastlane

# Initialize fastlane
cd ios
fastlane init
```

## Step 3: App Store Connect setup

1. Go to https://appstoreconnect.apple.com
2. Create a new app:
   - **Platform**: iOS
   - **Name**: UspAIChat
   - **Bundle ID**: ru.aifuturenow.uspaichat
   - **SKU**: uspaichat-mobile
   - **Primary Language**: Russian
3. Fill in the required info:
   - **Description** (see below)
   - **Screenshots** (at least iPhone 6.7" and iPhone 5.5")
   - **Category**: Productivity
   - **Keywords**: AI, chat, GPT, Claude, Gemini, assistant
   - **Privacy Policy URL**: your privacy policy page
   - **Support URL**: https://app.aifuturenow.ru

## Step 4: Build for release

```bash
cd /path/to/UspAIChat/mobile

# Clean build
flutter clean
flutter pub get
cd ios && pod install && cd ..

# Build IPA for App Store
flutter build ipa --release

# The IPA file will be at:
# build/ios/ipa/uspaichat_mobile.ipa
```

## Step 5: Upload to App Store Connect

### Option A: Using Xcode
```bash
# Open the archive in Xcode
open build/ios/archive/Runner.xcarchive
# Then use Xcode Organizer: Window → Organizer → Distribute App → App Store Connect
```

### Option B: Using xcrun
```bash
xcrun altool --upload-app \
  --type ios \
  --file build/ios/ipa/uspaichat_mobile.ipa \
  --apiKey YOUR_API_KEY \
  --apiIssuer YOUR_ISSUER_ID
```

### Option C: Using Transporter app
1. Download "Transporter" from Mac App Store
2. Drag & drop the .ipa file
3. Click "Deliver"

## Step 6: Submit for review

1. Go to App Store Connect
2. Select your app → "App Store" tab
3. Click "+ Version or Platform" if needed
4. Fill in "What's New in This Version"
5. Select the uploaded build
6. Click "Submit for Review"

---

## App Description (Russian)

```
UspAIChat — умный AI-ассистент с поддержкой нескольких провайдеров:

• Anthropic Claude (Opus, Sonnet, Haiku)
• OpenAI GPT-4o, GPT-4 Turbo, GPT-3.5
• Google Gemini Pro, Gemini Flash
• DeepSeek V3, DeepSeek Chat
• Kimi (Moonshot AI)

Возможности:
— Потоковая генерация ответов в реальном времени
— Голосовой ввод и озвучка ответов
— Загрузка файлов и изображений
— Полнотекстовый поиск по беседам
— Шаблоны промптов для быстрого доступа
— Папки для организации бесед
— Экспорт чатов в Markdown, JSON, TXT
— Шаринг бесед по ссылке
— Системные промпты и готовые персоны
— Темная тема
— Мультиязычность (RU, EN, ZH)

Авторизация через Google, Apple ID или Telegram.
```

## App Description (English)

```
UspAIChat — smart AI assistant supporting multiple providers:

• Anthropic Claude (Opus, Sonnet, Haiku)
• OpenAI GPT-4o, GPT-4 Turbo, GPT-3.5
• Google Gemini Pro, Gemini Flash
• DeepSeek V3, DeepSeek Chat
• Kimi (Moonshot AI)

Features:
— Real-time streaming responses
— Voice input and text-to-speech
— File and image uploads
— Full-text search across conversations
— Prompt templates for quick access
— Folders for conversation organization
— Export chats to Markdown, JSON, TXT
— Share conversations via link
— System prompts with preset personas
— Dark theme
— Multi-language (RU, EN, ZH)

Sign in with Google, Apple ID, or Telegram.
```

## Required Privacy Policy items

Since the app uses:
- **Speech Recognition** (NSSpeechRecognitionUsageDescription)
- **Microphone** (NSMicrophoneUsageDescription)
- **Camera/Photos** (for file upload)
- **Network access** (API calls)

Your privacy policy must cover these data uses.

## Checklist before submission

- [ ] Bundle ID matches App Store Connect
- [ ] Version number incremented (pubspec.yaml: `version: 1.0.0+1`)
- [ ] App icons are set (1024x1024 for App Store)
- [ ] Launch screen configured
- [ ] Privacy policy URL is live
- [ ] Screenshots prepared (6.7", 5.5", iPad if supporting)
- [ ] App description filled in both languages
- [ ] Signing configured with distribution certificate
- [ ] Tested on physical iPhone device
- [ ] No debug flags in release build
