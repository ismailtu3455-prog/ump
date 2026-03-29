import { Language, ThemeMode, WindowSettings, PlayerSettings, Hotkeys } from '@/types';

const STORAGE_KEY = 'ump.settings.v2';

export interface PersistedSettings {
  theme: ThemeMode;
  language: Language;
  windowSettings: Pick<WindowSettings, 'opacity' | 'accentColor' | 'autoStart' | 'trayMode'>;
  playerSettings: Pick<PlayerSettings, 'delayEnabled' | 'playbackDelaySec'>;
  hotkeys: Hotkeys;
  autoSaveOnAdd: boolean;
}

export function loadSavedSettings(): Partial<PersistedSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    if (!parsed || typeof parsed !== 'object') return {};

    return parsed;
  } catch {
    return {};
  }
}

export function saveSettings(value: PersistedSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function saveSettingsPatch(patch: Partial<PersistedSettings>) {
  const current = loadSavedSettings();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
}
