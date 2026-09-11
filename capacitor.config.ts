import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.taekine.inventory',
  appName: '택이네 재고',
  webDir: 'dist',
  android: {
    // 앱 안에 웹 자산을 담아 실행하므로 인터넷 없이도 켜진다
    allowMixedContent: false,
  },
  backgroundColor: '#F8F9FB',
};

export default config;
