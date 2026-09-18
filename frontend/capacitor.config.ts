import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'de.pmmx.app',
  appName: 'pmmx',
  webDir: 'dist',
  server: {
    // Für Entwicklung: Backend-URL eintragen.
    // Für Production-Build leer lassen (App lädt aus dist/).
    // url: 'http://192.168.1.x:80',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
