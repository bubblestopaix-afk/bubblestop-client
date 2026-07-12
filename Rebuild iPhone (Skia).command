#!/bin/zsh
# 📱 Reconstruit l'app de dev SUR TON IPHONE branché en USB.
# Nécessaire si le build de l'iPhone date d'AVANT l'ajout de Skia (rendu natif du
# shooter) — symptôme : Infini / Aventure crashent, le reste marche.
# Déverrouille l'iPhone, accepte « Se fier à cet ordinateur » si demandé.
cd "$(dirname "$0")"
npx expo run:ios --device
