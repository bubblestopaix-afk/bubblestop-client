#!/bin/zsh
# 🔄 Relance le serveur de dev avec un cache PROPRE — répare les « bundles mélangés »
# (erreurs du type « X is not a function (it is undefined) » après un gros refactor).
# Le simulateur ET l'iPhone se reconnectent tout seuls ; relance l'app dessus ensuite.
cd "$(dirname "$0")"
npx expo start --dev-client --clear
