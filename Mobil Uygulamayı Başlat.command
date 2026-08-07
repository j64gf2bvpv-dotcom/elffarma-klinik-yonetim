#!/bin/zsh
# Elffarma Mobil uygulamasını (Expo, web modu) tek tıkla başlatır.
# Finder'da bu dosyaya çift tıklayın — bir Terminal penceresi açılır,
# gerekli paketleri kontrol eder ve uygulamayı tarayıcıda açar.
#
# Not: expo-sqlite / bottom-sheet gibi bazı native modüller web modunda
# sınırlı çalışabilir — tam deneyim için gerçek cihazda Expo Go veya
# `npx expo run:ios` / `run:android` (Xcode/Android Studio gerektirir).

set -e
cd "$(dirname "$0")/mobile"

export PATH="$HOME/.local/node/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "HATA: node bulunamadı. Node.js kurulu olmalı (~/.local/node/bin altında bekleniyor)."
  read "?Kapatmak için Enter'a basın..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "İlk çalıştırma — paketler kuruluyor (birkaç dakika sürebilir)..."
  npm install
fi

echo "Elffarma Mobil başlatılıyor (tarayıcıda açılacak)..."
npm run web

read "?Kapatmak için Enter'a basın..."
