# Инструкция: публикация UspAIChat в App Store

## Контекст проекта

Flutter-приложение находится в директории `mobile/`. Основные параметры:
- **Bundle ID:** `ru.aifuturenow.uspaichatMobile`
- **Текущая версия:** 1.0.0+1
- **Min iOS:** 12.0
- **Язык:** Swift 5.0
- **Плагины:** google_sign_in, sign_in_with_apple, image_picker, speech_to_text, flutter_tts, file_picker, permission_handler, flutter_secure_storage

## Предварительные требования

1. **Apple Developer Account** ($99/год) — должен быть активен
2. **Xcode** последней версии установлен
3. **Flutter SDK** >= 3.27.0 установлен
4. **CocoaPods** установлен (`sudo gem install cocoapods`)

## Шаг 1: Подготовка в App Store Connect

1. Зайти на https://appstoreconnect.apple.com
2. Создать новое приложение:
   - **Bundle ID:** `ru.aifuturenow.uspaichatMobile`
   - **Название:** UspAIChat (или "AI Future Now Chat" — проверь доступность)
   - **Язык:** русский (или английский)
   - **SKU:** `uspaichat-mobile`
3. Заполнить метаданные:
   - Описание, ключевые слова, категория (Productivity или Utilities)
   - Скриншоты для iPhone 6.7" и 6.5" (обязательно), iPad если поддерживается
   - Иконка 1024x1024 (без альфа-канала, без скругленных углов)
   - URL политики конфиденциальности (обязательно)
   - Возрастной рейтинг

## Шаг 2: Настройка подписи и сертификатов

```bash
# Открыть проект в Xcode
cd mobile/ios
open Runner.xcworkspace
```

В Xcode:
1. Выбрать target **Runner**
2. Вкладка **Signing & Capabilities**
3. Включить **Automatically manage signing**
4. Выбрать свой **Team** (Apple Developer аккаунт)
5. Xcode автоматически создаст provisioning profile

## Шаг 3: Добавить недостающие permissions в Info.plist

В файле `mobile/ios/Runner/Info.plist` сейчас есть только микрофон и распознавание речи. Нужно добавить (т.к. используются image_picker и file_picker):

```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>Access to photo library for sending images in chat</string>
<key>NSCameraUsageDescription</key>
<string>Camera access for taking photos to send in chat</string>
```

Apple **отклонит** приложение если плагин запрашивает permission без описания в Info.plist.

## Шаг 4: Настройка Associated Domains и Capabilities (если нужно)

Если используется Apple Sign-In (а он используется), нужно:
1. В Xcode → Runner → Signing & Capabilities → **+ Capability**
2. Добавить **Sign in with Apple**

## Шаг 5: Настроить имя и версию приложения

В `mobile/pubspec.yaml`:
```yaml
version: 1.0.0+1   # формат: version+build_number
```

В `mobile/ios/Runner/Info.plist` поменять display name:
```xml
<key>CFBundleDisplayName</key>
<string>UspAIChat</string>
```

## Шаг 6: Подготовить иконки

Убедиться что `mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset/` содержит все необходимые размеры иконок. Можно сгенерировать через https://appicon.co или пакет `flutter_launcher_icons`.

## Шаг 7: Сборка и загрузка

```bash
cd mobile

# Очистить предыдущие сборки
flutter clean

# Установить зависимости
flutter pub get

# Установить pods
cd ios && pod install && cd ..

# Собрать релизную версию
flutter build ipa --release

# Если нужен конкретный export:
flutter build ipa --release --export-options-plist=ios/ExportOptions.plist
```

Если `ExportOptions.plist` не существует, создай его:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>ТВОЙ_TEAM_ID</string>
    <key>uploadBitcode</key>
    <false/>
    <key>uploadSymbols</key>
    <true/>
</dict>
</plist>
```

## Шаг 8: Загрузка в App Store Connect

Вариант A — через Xcode:
```
Xcode → Window → Organizer → выбрать архив → Distribute App → App Store Connect
```

Вариант B — через командную строку:
```bash
xcrun altool --upload-app --type ios \
  --file build/ios/ipa/uspaichat_mobile.ipa \
  --apiKey YOUR_API_KEY \
  --apiIssuer YOUR_ISSUER_ID
```

Вариант C — через Transporter (приложение от Apple из Mac App Store).

## Шаг 9: Отправка на ревью

1. В App Store Connect выбрать загруженный билд
2. Заполнить все обязательные поля
3. Указать данные для ревьюера (тестовый аккаунт если нужен логин)
4. Нажать **Submit for Review**

## Частые причины отклонения (для этого приложения)

- **Нет политики конфиденциальности** — обязательно добавить URL
- **Нет описания permissions** — убедиться что ВСЕ используемые разрешения описаны в Info.plist
- **Sign in with Apple** — если есть Google Sign-In, Apple **требует** также предоставить Apple Sign-In (уже есть в приложении)
- **API ключи в коде** — убедиться что серверный URL указывает на продакшн `app.aifuturenow.ru`
- **Минимальный функционал** — приложение должно работать без крэшей, все экраны должны быть доступны

## Важно

- **Team ID** можно найти на https://developer.apple.com/account → Membership Details
- Первый ревью обычно занимает 24-48 часов
- Для увеличения build number при повторной загрузке: поменять `1.0.0+1` на `1.0.0+2` в `pubspec.yaml`
