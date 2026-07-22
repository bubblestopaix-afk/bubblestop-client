import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

// Marques officielles affichées dans les boutons Wallet. Elles remplacent les
// boutons purement textuels, sans ajouter de dépendance native ni exposer de code client.
export function AppleLogo({ size = 21, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 384 512" accessibilityLabel="Apple">
      <Path
        fill={color}
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-72.5-19.2-30.9.5-59.7 17.9-75.6 45.6-31.9 55.3-8.2 136.9 22.9 181.8 15.2 21.9 33.3 46.4 57.1 45.5 22.9-.9 31.6-14.7 59.4-14.7 26.9 0 34.5 14.7 58.6 14.2 24.2-.4 39.5-22 54.6-44 17.5-25.5 24.7-50.2 25.1-51.5-.5-.2-48.2-18.5-48.4-73.5-.2-46 37.6-68 39.3-69.1-21.6-31.8-55-35.3-66.6-36.2-30.3-2.4-59 17.8-74.4 17.8-15.9 0-40-17-65.2-16.6-32.5.5-62.7 18.8-79.4 47.8-34.1 59.1-8.7 146 24.5 194.1 16.2 23.5 35.6 49.7 61 48.8 24.5-1 33.7-15.8 63.3-15.8 28.7 0 36.7 15.8 62.5 15.2 25.8-.4 42.2-23.8 58.3-47.5 18.6-27.2 26.3-53.5 26.7-54.9-.6-.2-51.2-19.7-51.5-78.1zM263.4 106.9c13.5-16.2 22.6-38.8 20.1-61.4-19.4.8-42.9 13-56.9 29.2-12.5 14.4-23.5 37.4-20.6 59.5 21.7 1.7 43.9-11 57.4-27.3z"
      />
    </Svg>
  );
}

export function GoogleWalletLogo({ size = 25 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="20 11 38 32" accessibilityLabel="Google Wallet">
      <Defs>
        <LinearGradient id="walletBlue" x1="37.3" y1="34" x2="18.8" y2="55.7" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#4285F4" />
          <Stop offset="1" stopColor="#1B74E8" />
        </LinearGradient>
      </Defs>
      <Path d="M57 23.791H21V18.146C21 15.081 23.642 12.5 26.78 12.5h24.44c3.138 0 5.78 2.581 5.78 5.646v5.645Z" fill="#34A853" />
      <Path d="M57 29H21v-6c0-3.257 2.642-6 5.78-6h24.44C54.358 17 57 19.743 57 23v6Z" fill="#FBBC04" />
      <Path d="M57 34H21v-6c0-3.257 2.642-6 5.78-6h24.44C54.358 22 57 24.743 57 28v6Z" fill="#EA4335" />
      <Path d="m21 25.241 22.849 5.162c2.631.645 5.589 0 7.726-1.614L57 24.918v12.098c0 3.064-2.63 5.484-5.753 5.484H26.753C23.63 42.5 21 40.08 21 37.016V25.24Z" fill="url(#walletBlue)" />
    </Svg>
  );
}
