// === QR code en pur React Native (grille de Views, zéro dépendance native) ===
// Utilisé par la carte fidélité (explore) et le parrainage. Déploiement = OTA.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import QRCode from 'qrcode';

export default function QrView({ valeur, taille = 210 }: { valeur: string; taille?: number }) {
  const [matrice, setMatrice] = useState<{ size: number; data: Uint8Array } | null>(null);

  useEffect(() => {
    try {
      const qr = QRCode.create(valeur, { errorCorrectionLevel: 'M' });
      setMatrice(qr.modules as any);
    } catch (e) {
      setMatrice(null);
    }
  }, [valeur]);

  if (!matrice) return null;
  const n = matrice.size;
  const cellule = taille / n;
  const lignes = [];
  for (let y = 0; y < n; y++) {
    const cases = [];
    for (let x = 0; x < n; x++) {
      cases.push(
        <View
          key={x}
          style={{ width: cellule, height: cellule, backgroundColor: matrice.data[y * n + x] ? '#1A1325' : '#fff' }}
        />
      );
    }
    lignes.push(<View key={y} style={{ flexDirection: 'row' }}>{cases}</View>);
  }
  return <View style={{ padding: 14, backgroundColor: '#fff', borderRadius: 16 }}>{lignes}</View>;
}
