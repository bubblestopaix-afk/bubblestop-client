#!/bin/zsh
# 🎨 Installe react-native-skia (dépendance native) puis rebuild le simulateur iOS
cd "$(dirname "$0")"
echo "🎨 Boba Quest — passage au rendu Skia"
echo "1/2 · installation de @shopify/react-native-skia…"
npx expo install @shopify/react-native-skia
echo "2/2 · rebuild natif du simulateur (quelques minutes)…"
npx expo run:ios
