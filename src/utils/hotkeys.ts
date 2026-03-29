import { HotkeyAction, Hotkeys } from '@/types';

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift'] as const;

export const DEFAULT_HOTKEYS: Hotkeys = {
  togglePlayPause: 'Space',
  previousTrack: 'P',
  nextTrack: 'N',
  toggleRepeat: 'R',
  seekBackward: 'ArrowLeft',
  seekForward: 'ArrowRight',
  volumeDown: 'ArrowDown',
  volumeUp: 'ArrowUp',
  speedDown: 'Ctrl+ArrowDown',
  speedUp: 'Ctrl+ArrowUp',
  speedReset: 'Ctrl+0',
  toggleMute: 'M',
  toggleFullscreen: 'F',
  openFiles: 'Ctrl+O',
};

export const HOTKEY_ACTION_ORDER: HotkeyAction[] = [
  'togglePlayPause',
  'previousTrack',
  'nextTrack',
  'toggleRepeat',
  'seekBackward',
  'seekForward',
  'volumeDown',
  'volumeUp',
  'speedDown',
  'speedUp',
  'speedReset',
  'toggleMute',
  'toggleFullscreen',
  'openFiles',
];

function normalizeKeyName(key: string) {
  const map: Record<string, string> = {
    ' ': 'Space',
    Spacebar: 'Space',
    Escape: 'Esc',
    Esc: 'Esc',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
  };

  if (map[key]) return map[key];
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function normalizeCodeName(code: string) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
  if (code === 'Space') return 'Space';
  return '';
}

export function normalizeHotkey(value: string) {
  const rawParts = value
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

  if (rawParts.length === 0) return '';

  const mods: string[] = [];
  let key = '';

  for (const part of rawParts) {
    const normalized = normalizeKeyName(part);
    const lower = normalized.toLowerCase();

    if (lower === 'ctrl' || lower === 'control' || lower === 'meta' || lower === 'cmd') {
      if (!mods.includes('Ctrl')) mods.push('Ctrl');
      continue;
    }

    if (lower === 'alt' || lower === 'option') {
      if (!mods.includes('Alt')) mods.push('Alt');
      continue;
    }

    if (lower === 'shift') {
      if (!mods.includes('Shift')) mods.push('Shift');
      continue;
    }

    key = normalized;
  }

  const orderedMods = MODIFIER_ORDER.filter((mod) => mods.includes(mod));
  if (!key) {
    return orderedMods.join('+');
  }

  return [...orderedMods, key].join('+');
}

export function keyboardEventToHotkey(event: KeyboardEvent) {
  const codeBased = normalizeCodeName(event.code);
  const baseKey = codeBased || normalizeKeyName(event.key);
  if (baseKey === 'Control' || baseKey === 'Shift' || baseKey === 'Alt' || baseKey === 'Meta') {
    return '';
  }

  if (baseKey === 'Dead' || baseKey === 'Unidentified') {
    return '';
  }

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  parts.push(baseKey);
  return normalizeHotkey(parts.join('+'));
}

export function hotkeyMatches(eventCombo: string, binding: string) {
  if (!eventCombo || !binding) return false;
  return normalizeHotkey(eventCombo) === normalizeHotkey(binding);
}
