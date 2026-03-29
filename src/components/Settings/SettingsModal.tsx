import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import { addNotification, setHotkeys, setLanguage, setPlayerSettings, setTheme, setWindowSettings } from '@store/uiSlice';
import { DEFAULT_HOTKEYS, HOTKEY_ACTION_ORDER, keyboardEventToHotkey } from '@utils/hotkeys';
import { saveSettings } from '@utils/settingsStorage';
import { translations } from '@utils/translations';
import { HotkeyAction } from '@/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const accentPresets = ['#4f9dff', '#ff6b6b', '#20c997', '#f59f00', '#b197fc', '#ff922b'];

function ToggleRow({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-white/55">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition ${checked ? 'bg-white/35' : 'bg-white/15'}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`}
        />
      </button>
    </div>
  );
}

function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const dispatch = useAppDispatch();

  const language = useAppSelector((state) => state.ui.language);
  const theme = useAppSelector((state) => state.ui.theme);
  const windowSettings = useAppSelector((state) => state.ui.windowSettings);
  const playerSettings = useAppSelector((state) => state.ui.playerSettings);
  const hotkeys = useAppSelector((state) => state.ui.hotkeys);
  const autoSaveOnAdd = useAppSelector((state) => state.ui.autoSaveOnAdd);

  const t = translations[language];

  const [activeTab, setActiveTab] = useState<'general' | 'hotkeys'>('general');
  const [localTheme, setLocalTheme] = useState(theme);
  const [localLanguage, setLocalLanguage] = useState(language);
  const [accentColor, setAccentColor] = useState(windowSettings.accentColor);
  const [opacity, setOpacity] = useState(windowSettings.opacity);
  const [trayMode, setTrayMode] = useState(windowSettings.trayMode);
  const [autoStart, setAutoStart] = useState(windowSettings.autoStart);
  const [delayEnabled, setDelayEnabled] = useState(playerSettings.delayEnabled);
  const [playbackDelaySec, setPlaybackDelaySec] = useState(playerSettings.playbackDelaySec);
  const [localHotkeys, setLocalHotkeys] = useState(hotkeys);
  const [editingHotkey, setEditingHotkey] = useState<HotkeyAction | null>(null);

  const isHydratingRef = useRef(false);
  const normalizedDelay = Math.max(0, Math.min(30, playbackDelaySec));

  const hotkeyLabels = useMemo(
    () => ({
      togglePlayPause: t.hkTogglePlayPause,
      previousTrack: t.hkPreviousTrack,
      nextTrack: t.hkNextTrack,
      toggleRepeat: t.hkToggleRepeat,
      seekBackward: t.hkSeekBackward,
      seekForward: t.hkSeekForward,
      volumeDown: t.hkVolumeDown,
      volumeUp: t.hkVolumeUp,
      speedDown: t.hkSpeedDown,
      speedUp: t.hkSpeedUp,
      speedReset: t.hkSpeedReset,
      toggleMute: t.hkToggleMute,
      toggleFullscreen: t.hkToggleFullscreen,
      openFiles: t.hkOpenFiles,
    }),
    [t]
  );

  const applyRuntimeSettings = useCallback(async () => {
    dispatch(setTheme(localTheme));
    dispatch(setLanguage(localLanguage));

    dispatch(
      setWindowSettings({
        accentColor,
        opacity,
        trayMode,
        autoStart,
      })
    );

    dispatch(
      setPlayerSettings({
        delayEnabled,
        playbackDelaySec: normalizedDelay,
      })
    );

    dispatch(setHotkeys(localHotkeys));

    await window.electronAPI?.setTrayMode(trayMode).catch(() => undefined);
    await window.electronAPI?.setAutoStart(autoStart).catch(() => undefined);
  }, [
    accentColor,
    autoStart,
    delayEnabled,
    dispatch,
    localHotkeys,
    localLanguage,
    localTheme,
    normalizedDelay,
    opacity,
    trayMode,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    isHydratingRef.current = true;
    setActiveTab('general');
    setEditingHotkey(null);
    setLocalTheme(theme);
    setLocalLanguage(language);
    setAccentColor(windowSettings.accentColor);
    setOpacity(windowSettings.opacity);
    setTrayMode(windowSettings.trayMode);
    setAutoStart(windowSettings.autoStart);
    setDelayEnabled(playerSettings.delayEnabled);
    setPlaybackDelaySec(playerSettings.playbackDelaySec);
    setLocalHotkeys(hotkeys);

    window.electronAPI
      ?.getAutoStart()
      .then((result) => {
        if (result?.success) {
          setAutoStart(Boolean(result.enabled));
        }
      })
      .catch(() => undefined);

    window.electronAPI
      ?.getTrayMode()
      .then((result) => {
        if (result?.success) {
          setTrayMode(Boolean(result.enabled));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        window.setTimeout(() => {
          isHydratingRef.current = false;
        }, 0);
      });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (isHydratingRef.current) return;

    const timer = window.setTimeout(() => {
      applyRuntimeSettings().catch(() => undefined);
    }, 100);

    return () => window.clearTimeout(timer);
  }, [
    accentColor,
    applyRuntimeSettings,
    autoStart,
    delayEnabled,
    isOpen,
    localHotkeys,
    localLanguage,
    localTheme,
    opacity,
    playbackDelaySec,
    trayMode,
  ]);

  useEffect(() => {
    if (!editingHotkey) return;

    const handleHotkeyCapture = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setEditingHotkey(null);
        return;
      }

      const combo = keyboardEventToHotkey(event);
      if (!combo) return;

      setLocalHotkeys((prev) => ({ ...prev, [editingHotkey]: combo }));
      setEditingHotkey(null);
    };

    window.addEventListener('keydown', handleHotkeyCapture, true);
    return () => window.removeEventListener('keydown', handleHotkeyCapture, true);
  }, [editingHotkey]);

  if (!isOpen) return null;

  const handleSave = async () => {
    await applyRuntimeSettings();

    saveSettings({
      theme: localTheme,
      language: localLanguage,
      windowSettings: {
        accentColor,
        opacity,
        autoStart,
        trayMode,
      },
      playerSettings: {
        delayEnabled,
        playbackDelaySec: normalizedDelay,
      },
      hotkeys: localHotkeys,
      autoSaveOnAdd,
    });

    dispatch(
      addNotification({
        type: 'success',
        title: t.settings,
        message: t.settingsSaved,
      })
    );
  };

  const handleResetHotkeys = () => {
    setLocalHotkeys(DEFAULT_HOTKEYS);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="glass-panel modal-enter max-h-[86vh] w-[620px] overflow-auto rounded-3xl p-5"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{t.settings}</h2>
          <button
            type="button"
            onClick={onClose}
            className="interactive-btn rounded-lg px-2.5 py-1.5 text-xs text-white/70"
          >
            {t.close}
          </button>
        </div>

        <p className="mb-3 text-xs text-white/55">{t.settingsAppliedAuto}</p>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              activeTab === 'general'
                ? 'border-white/30 bg-white/20 text-white'
                : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            {t.generalTab}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hotkeys')}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              activeTab === 'hotkeys'
                ? 'border-white/30 bg-white/20 text-white'
                : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            {t.hotkeysTab}
          </button>
        </div>

        {activeTab === 'general' && (
          <div className="space-y-4">
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">{t.appearance}</p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLocalTheme('dark')}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    localTheme === 'dark'
                      ? 'border-white/30 bg-white/20 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {t.darkTheme}
                </button>

                <button
                  type="button"
                  onClick={() => setLocalTheme('light')}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    localTheme === 'light'
                      ? 'border-white/30 bg-white/20 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {t.lightTheme}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLocalLanguage('ru')}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    localLanguage === 'ru'
                      ? 'border-white/30 bg-white/20 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  RU
                </button>

                <button
                  type="button"
                  onClick={() => setLocalLanguage('en')}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    localLanguage === 'en'
                      ? 'border-white/30 bg-white/20 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  EN
                </button>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <p className="text-sm font-medium text-white">{t.accentColor}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {accentPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAccentColor(preset)}
                      className={`h-7 w-7 rounded-full border transition ${
                        accentColor === preset ? 'scale-110 border-white' : 'border-white/30'
                      }`}
                      style={{ backgroundColor: preset }}
                    />
                  ))}
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(event) => setAccentColor(event.target.value)}
                    className="h-7 w-7 cursor-pointer rounded-full border border-white/30 bg-transparent"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <div className="mb-2 flex items-center justify-between text-sm text-white">
                  <span>{t.panelTransparency}</span>
                  <span className="text-white/65">{opacity}%</span>
                </div>
                <input
                  type="range"
                  min={45}
                  max={100}
                  step={1}
                  value={opacity}
                  onChange={(event) => setOpacity(Number(event.target.value))}
                  className="player-range w-full"
                />
              </div>

              <ToggleRow
                label={t.trayMode}
                description={t.trayModeHint}
                checked={trayMode}
                onChange={setTrayMode}
              />
              <ToggleRow label={t.autoStart} checked={autoStart} onChange={setAutoStart} />
            </section>

            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">{t.playback}</p>

              <ToggleRow label={t.delayEnabled} checked={delayEnabled} onChange={setDelayEnabled} />

              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                <div className="mb-2 flex items-center justify-between text-sm text-white">
                  <span>{t.delaySec}</span>
                  <span className="text-white/65">{normalizedDelay} s</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={normalizedDelay}
                  disabled={!delayEnabled}
                  onChange={(event) => setPlaybackDelaySec(Number(event.target.value))}
                  className="player-range w-full disabled:cursor-not-allowed disabled:opacity-40"
                />
              </div>
            </section>
          </div>
        )}

        {activeTab === 'hotkeys' && (
          <div className="space-y-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm text-white/70">{t.hkPressHint}</p>
              <button
                type="button"
                onClick={handleResetHotkeys}
                className="interactive-btn rounded-lg px-3 py-1.5 text-xs text-white/85"
              >
                {t.hkReset}
              </button>
            </div>

            <div className="space-y-2">
              {HOTKEY_ACTION_ORDER.map((action) => (
                <div
                  key={action}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <span className="text-sm text-white">{hotkeyLabels[action]}</span>
                  <button
                    type="button"
                    onClick={() => setEditingHotkey(action)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      editingHotkey === action
                        ? 'border-amber-300/60 bg-amber-500/20 text-amber-100'
                        : 'border-white/20 bg-white/10 text-white/90 hover:bg-white/20'
                    }`}
                  >
                    {editingHotkey === action ? t.hkRecording : localHotkeys[action]}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="interactive-btn rounded-xl px-4 py-2 text-xs text-white/80"
          >
            {t.cancel}
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-white/20 px-4 py-2 text-xs font-medium text-white transition hover:bg-white/30"
          >
            {t.saveForNextLaunch}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
