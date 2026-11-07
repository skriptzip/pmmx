// Minimale i18n ohne Abhängigkeit. Sprache wird beim Start aus den Browsereinstellungen
// bestimmt: Deutsch, wenn irgendeine bevorzugte Sprache mit "de" beginnt, sonst Englisch.

const de = {
  // Navigation
  'nav.home': 'Start',
  'nav.library': 'Bibliothek',
  'nav.audio': 'Audio',
  'nav.settings': 'Einstellungen',

  // Allgemein
  'common.loading': 'Lädt…',
  'common.missing': 'Fehlt',
  'common.soon': 'Bald',
  'common.available': 'Verfügbar',
  'common.present': 'Vorhanden',
  'common.all': 'Alle',
  'common.everything': 'Alles',
  'common.movies': 'Filme',
  'common.series': 'Serien',

  // Streaming-Typen
  'type.flatrate': 'Abo',
  'type.rent': 'Leihen',
  'type.buy': 'Kaufen',

  // Server-Setup (nur native App)
  'setup.title': 'Server verbinden',
  'setup.hint': 'Gib die Adresse deines pmmx-Servers ein (HTTPS).',
  'setup.connect': 'Verbinden',
  'setup.checking': 'Prüfe…',
  'setup.errUnreachable': 'Server nicht erreichbar. Adresse und HTTPS prüfen.',
  'set.changeServer': 'Server wechseln',

  // Login
  'login.subtitle': 'Plex Missing-Media-Scanner',
  'login.button': 'Mit Plex anmelden',
  'login.hint': 'Klicke den Button um dich bei Plex anzumelden.',
  'login.hint2': 'Diese Seite wartet automatisch auf Bestätigung.',
  'login.link': 'Zur Plex-Anmeldeseite →',
  'login.waiting': 'Warte auf Login…',
  'login.creatingPin': 'PIN wird erstellt…',
  'login.cancel': 'Abbrechen',
  'login.selectServer': 'Server auswählen:',
  'login.owned': 'Eigener',
  'login.errExpired': 'Anmeldelink abgelaufen. Bitte erneut versuchen.',
  'login.errPin': 'PIN-Erstellung fehlgeschlagen. Bitte erneut versuchen.',
  'login.errServer': 'Server-Auswahl fehlgeschlagen. Bitte erneut versuchen.',

  // Dashboard
  'dash.title': 'Übersicht',
  'dash.stage.starting': 'Wird gestartet…',
  'dash.stage.plex': 'Plex-Bibliothek wird geladen…',
  'dash.stage.movies': 'Filme werden geprüft',
  'dash.stage.series': 'Serien werden geprüft',
  'dash.stage.audio': 'Sprachspuren werden geprüft…',
  'dash.stage.availability': 'Streaming-Verfügbarkeit…',
  'dash.stage.done': 'Abgeschlossen',
  'dash.missingMovies': 'Fehlende Filme',
  'dash.missingEpisodes': 'Fehlende Episoden',
  'dash.upcoming': 'Bald verfügbar',
  'dash.streamable': 'Verfügbar',
  'dash.filesCount': '{n} Dateien',
  'dash.withMissingLangs': ' mit fehlenden Sprachspuren',
  'dash.scanRunning': 'Scan läuft…',
  'dash.scanStart': 'Scan starten',
  'dash.rescanPlex': 'Plex neu einlesen',
  'dash.rescanTitle': 'Liest nur Plex neu ein und gleicht den Status lokal ab, ohne TMDb-Anfragen',
  'dash.lastScan': 'Letzter Scan:',
  'dash.scanDone': 'Fertig',
  'dash.scanFailed': 'Fehler',
  'dash.scanRunningShort': 'Läuft',

  // Bibliothek
  'lib.title': 'Bibliothek',
  'lib.complete': 'Komplett',
  'lib.incomplete': 'Unvollständig',
  'lib.searchMovie': 'Film oder Kollektion suchen…',
  'lib.searchShow': 'Serie suchen…',
  'lib.noMovies1': 'Noch keine Filmbibliothek vorhanden.',
  'lib.noShows1': 'Noch keine Serien vorhanden.',
  'lib.scanHint': 'Starte einen Scan um die Bibliothek zu laden.',
  'lib.moreMovies': 'Weitere Filme ({n})',
  'lib.nMissing': '{n} fehlt',
  'lib.nSoon': '{n} bald',
  'lib.nMissingPl': '{n} fehlend',
  'lib.noStreaming': 'Keine Streaming-Angebote verfügbar.',
  'lib.episodesPresent': '{a} / {b} Episoden vorhanden',
  'lib.completeCheck': '✓ Komplett',
  'lib.checking': 'Prüfe…',
  'lib.refresh': 'Aktualisieren',
  'lib.refreshFailed': 'Aktualisierung fehlgeschlagen.',
  'lib.availableAt': 'Verfügbar bei',
  'lib.nEpisodes': ' ({n} Episoden)',
  'lib.noMissingEpisodes': 'Keine fehlenden Episoden. Serie ist vollständig vorhanden.',
  'lib.season': 'Staffel {n}',

  // Fehlend-Seite
  'missing.title': 'Fehlend',
  'missing.other': 'Sonstige',
  'missing.nothing': 'Nichts gefunden.',

  // Audio
  'audio.title': 'Fehlende Sprachspuren',
  'audio.allPresent': 'Alle konfigurierten Sprachen sind vorhanden.',
  'audio.audioMissing': 'Audio fehlt:',
  'audio.subsMissing': 'Untertitel fehlt:',
  'audio.openPlex': 'In Plex öffnen',

  // Einstellungen
  'set.title': 'Einstellungen',
  'set.audioLangs': 'Zielsprachen: Audio',
  'set.subLangs': 'Zielsprachen: Untertitel',
  'set.langPlaceholder': 'de, en, fr …',
  'set.ownServices': 'Eigene Streaming-Dienste',
  'set.ownServicesHint': 'Gesucht wird immer bei allen Anbietern. Deine Auswahl bestimmt nur, wofür du benachrichtigt wirst.',
  'set.region': 'Region',
  'set.notifications': 'Benachrichtigungen',
  'set.provider': 'Dienst',
  'set.off': 'Aus',
  'set.ntfyUrl': 'ntfy Server-URL',
  'set.topic': 'Topic',
  'set.webhookUrl': 'Webhook-URL',
  'set.apiToken': 'API Token',
  'set.apiTokenPh': 'App-Token von pushover.net',
  'set.userKey': 'User Key',
  'set.userKeyPh': 'Dein Pushover User Key',
  'set.saved': '✓ Gespeichert',
  'set.saveNotif': 'Benachrichtigungen speichern',
  'set.actions': 'Aktionen',
  'set.checkAvailability': 'Streaming-Verfügbarkeit prüfen',
  'set.logout': 'Abmelden',
} as const

export type TKey = keyof typeof de

const en: Record<TKey, string> = {
  'nav.home': 'Home',
  'nav.library': 'Library',
  'nav.audio': 'Audio',
  'nav.settings': 'Settings',

  'common.loading': 'Loading…',
  'common.missing': 'Missing',
  'common.soon': 'Soon',
  'common.available': 'Available',
  'common.present': 'In library',
  'common.all': 'All',
  'common.everything': 'All',
  'common.movies': 'Movies',
  'common.series': 'Shows',

  'type.flatrate': 'Stream',
  'type.rent': 'Rent',
  'type.buy': 'Buy',

  // Server setup (native app only)
  'setup.title': 'Connect to server',
  'setup.hint': 'Enter the address of your pmmx server (HTTPS).',
  'setup.connect': 'Connect',
  'setup.checking': 'Checking…',
  'setup.errUnreachable': 'Server unreachable. Check the address and HTTPS.',
  'set.changeServer': 'Change server',

  'login.subtitle': 'Plex Missing-Media-Scanner',
  'login.button': 'Sign in with Plex',
  'login.hint': 'Click the button to sign in to Plex.',
  'login.hint2': 'This page waits for confirmation automatically.',
  'login.link': 'Go to Plex sign-in page →',
  'login.waiting': 'Waiting for login…',
  'login.creatingPin': 'Creating PIN…',
  'login.cancel': 'Cancel',
  'login.selectServer': 'Select server:',
  'login.owned': 'Owned',
  'login.errExpired': 'Sign-in link expired. Please try again.',
  'login.errPin': 'Could not create PIN. Please try again.',
  'login.errServer': 'Server selection failed. Please try again.',

  'dash.title': 'Overview',
  'dash.stage.starting': 'Starting…',
  'dash.stage.plex': 'Loading Plex library…',
  'dash.stage.movies': 'Checking movies',
  'dash.stage.series': 'Checking shows',
  'dash.stage.audio': 'Checking language tracks…',
  'dash.stage.availability': 'Streaming availability…',
  'dash.stage.done': 'Finished',
  'dash.missingMovies': 'Missing movies',
  'dash.missingEpisodes': 'Missing episodes',
  'dash.upcoming': 'Coming soon',
  'dash.streamable': 'Available',
  'dash.filesCount': '{n} files',
  'dash.withMissingLangs': ' with missing language tracks',
  'dash.scanRunning': 'Scan running…',
  'dash.scanStart': 'Start scan',
  'dash.rescanPlex': 'Rescan Plex',
  'dash.rescanTitle': 'Only re-reads Plex and updates the status locally, without TMDb requests',
  'dash.lastScan': 'Last scan:',
  'dash.scanDone': 'Done',
  'dash.scanFailed': 'Failed',
  'dash.scanRunningShort': 'Running',

  'lib.title': 'Library',
  'lib.complete': 'Complete',
  'lib.incomplete': 'Incomplete',
  'lib.searchMovie': 'Search movie or collection…',
  'lib.searchShow': 'Search show…',
  'lib.noMovies1': 'No movie library yet.',
  'lib.noShows1': 'No shows yet.',
  'lib.scanHint': 'Start a scan to load the library.',
  'lib.moreMovies': 'More movies ({n})',
  'lib.nMissing': '{n} missing',
  'lib.nSoon': '{n} soon',
  'lib.nMissingPl': '{n} missing',
  'lib.noStreaming': 'No streaming offers available.',
  'lib.episodesPresent': '{a} / {b} episodes in library',
  'lib.completeCheck': '✓ Complete',
  'lib.checking': 'Checking…',
  'lib.refresh': 'Refresh',
  'lib.refreshFailed': 'Refresh failed.',
  'lib.availableAt': 'Available on',
  'lib.nEpisodes': ' ({n} episodes)',
  'lib.noMissingEpisodes': 'No missing episodes. The show is complete.',
  'lib.season': 'Season {n}',

  'missing.title': 'Missing',
  'missing.other': 'Other',
  'missing.nothing': 'Nothing found.',

  'audio.title': 'Missing language tracks',
  'audio.allPresent': 'All configured languages are present.',
  'audio.audioMissing': 'Audio missing:',
  'audio.subsMissing': 'Subtitles missing:',
  'audio.openPlex': 'Open in Plex',

  'set.title': 'Settings',
  'set.audioLangs': 'Target languages: Audio',
  'set.subLangs': 'Target languages: Subtitles',
  'set.langPlaceholder': 'de, en, fr …',
  'set.ownServices': 'Your streaming services',
  'set.ownServicesHint': 'All providers are always searched. Your selection only determines what you get notified about.',
  'set.region': 'Region',
  'set.notifications': 'Notifications',
  'set.provider': 'Service',
  'set.off': 'Off',
  'set.ntfyUrl': 'ntfy server URL',
  'set.topic': 'Topic',
  'set.webhookUrl': 'Webhook URL',
  'set.apiToken': 'API token',
  'set.apiTokenPh': 'App token from pushover.net',
  'set.userKey': 'User key',
  'set.userKeyPh': 'Your Pushover user key',
  'set.saved': '✓ Saved',
  'set.saveNotif': 'Save notifications',
  'set.actions': 'Actions',
  'set.checkAvailability': 'Check streaming availability',
  'set.logout': 'Sign out',
}

function detectLocale(): 'de' | 'en' {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
    // Erste bevorzugte Sprache, die wir unterstützen, gewinnt
    for (const l of langs) {
      const code = l.toLowerCase()
      if (code.startsWith('de')) return 'de'
      if (code.startsWith('en')) return 'en'
    }
  } catch { /* */ }
  return 'en'
}

export const locale = detectLocale()
const dict: Record<TKey, string> = locale === 'de' ? de : en

/** BCP-47-Tag für Datums- und Sortierfunktionen. */
export const dateLocale = locale === 'de' ? 'de-DE' : 'en-GB'

export function t(key: TKey, params?: Record<string, string | number>): string {
  let s: string = dict[key]
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v))
  }
  return s
}

if (typeof document !== 'undefined') document.documentElement.lang = locale
