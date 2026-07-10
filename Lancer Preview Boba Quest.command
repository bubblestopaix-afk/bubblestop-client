#!/bin/zsh
# 🧋 Boba Quest — preview iOS locale (aucun crédit EAS, rien n'est publié)
cd "$(dirname "$0")"
echo "🧋 Bubble Stop — build local + simulateur iOS (npx expo run:ios)"
echo "   Premier build : quelques minutes. Ensuite, Fast Refresh à chaque modif."
npx expo run:ios
