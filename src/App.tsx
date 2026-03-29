import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import { addFilesToPlaylist, setCurrentIndex } from '@store/playlistSlice';
import { setCurrentFile, setIsPlaying } from '@store/playerSlice';
import {
  addNotification,
  setAutoSaveOnAdd,
  setHotkeys,
  setLanguage,
  setPlayerSettings,
  setTheme,
  setWindowSettings,
  toggleSidebar,
} from '@store/uiSlice';
import Header from '@components/Header/Header';
import Sidebar from '@components/Sidebar/Sidebar';
import Player from '@components/Player/Player';
import Notifications from '@components/Notifications/Notifications';
import { createMediaFileFromPath } from '@utils/fileUtils';
import { hotkeyMatches, keyboardEventToHotkey } from '@utils/hotkeys';
import { loadSavedSettings } from '@utils/settingsStorage';
import { translations } from '@utils/translations';

const SettingsModal = lazy(() => import('@components/Settings/SettingsModal'));

function App() {
  const dispatch = useAppDispatch();

  const isSidebarOpen = useAppSelector((state) => state.ui.isSidebarOpen);
  const theme = useAppSelector((state) => state.ui.theme);
  const language = useAppSelector((state) => state.ui.language);
  const windowSettings = useAppSelector((state) => state.ui.windowSettings);
  const hotkeys = useAppSelector((state) => state.ui.hotkeys);
  const autoSaveOnAdd = useAppSelector((state) => state.ui.autoSaveOnAdd);
  const activePlaylistId = useAppSelector((state) => state.playlist.activePlaylistId);
  const playlists = useAppSelector((state) => state.playlist.playlists);

  const t = translations[language];

  const [showSettings, setShowSettings] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  const activePlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === activePlaylistId),
    [activePlaylistId, playlists]
  );

  const appendFiles = useCallback(
    (paths: string[]) => {
      const files = paths
        .map((path) => createMediaFileFromPath(path))
        .filter((file): file is NonNullable<typeof file> => Boolean(file));

      if (files.length === 0) return;

      const startIndex = activePlaylist?.files.length ?? 0;

      dispatch(addFilesToPlaylist({ playlistId: activePlaylistId, files }));
      dispatch(setCurrentIndex(startIndex));
      dispatch(setCurrentFile(files[0]));
      dispatch(setIsPlaying(files[0].type !== 'image'));

      if (autoSaveOnAdd) {
        const playlistName = activePlaylist?.name || 'recent';
        window.electronAPI?.saveFilesToPlaylist(playlistName, files).catch(() => undefined);
      }

      dispatch(
        addNotification({
          type: 'success',
          title: t.fileAdded,
          message: `${files.length} ${t.filesCount}`,
        })
      );
    },
    [activePlaylist?.files.length, activePlaylist?.name, activePlaylistId, autoSaveOnAdd, dispatch, t.fileAdded, t.filesCount]
  );

  useEffect(() => {
    const saved = loadSavedSettings();

    if (saved.theme) {
      dispatch(setTheme(saved.theme));
    }

    if (saved.language) {
      dispatch(setLanguage(saved.language));
    }

    if (saved.windowSettings) {
      dispatch(setWindowSettings(saved.windowSettings));

      if (typeof saved.windowSettings.autoStart === 'boolean') {
        window.electronAPI?.setAutoStart(saved.windowSettings.autoStart).catch(() => undefined);
      }

      if (typeof saved.windowSettings.trayMode === 'boolean') {
        window.electronAPI?.setTrayMode(saved.windowSettings.trayMode).catch(() => undefined);
      }
    }

    if (saved.playerSettings) {
      dispatch(setPlayerSettings(saved.playerSettings));
    }

    if (saved.hotkeys) {
      dispatch(setHotkeys(saved.hotkeys));
    }

    if (typeof saved.autoSaveOnAdd === 'boolean') {
      dispatch(setAutoSaveOnAdd(saved.autoSaveOnAdd));
    }
  }, [dispatch]);

  useEffect(() => {
    const handleOpenedFiles = (payload: string[] | string) => {
      const list = Array.isArray(payload) ? payload : [payload];
      appendFiles(list);
    };

    window.electronAPI?.on('files-selected', handleOpenedFiles);
    window.electronAPI?.on('file-opened', handleOpenedFiles);
    window.electronAPI?.on('files-opened', handleOpenedFiles);

    return () => {
      window.electronAPI?.off('files-selected', handleOpenedFiles);
      window.electronAPI?.off('file-opened', handleOpenedFiles);
      window.electronAPI?.off('files-opened', handleOpenedFiles);
    };
  }, [appendFiles]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty('--accent-color', windowSettings.accentColor);
    document.documentElement.style.setProperty('--window-opacity', String(windowSettings.opacity / 100));
  }, [theme, windowSettings.accentColor, windowSettings.opacity]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (showSettings) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        target?.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';

      if (isEditable) return;

      const combo = keyboardEventToHotkey(event);
      if (!combo) return;

      if (hotkeyMatches(combo, hotkeys.openFiles)) {
        event.preventDefault();
        window.electronAPI?.openFileDialog();
        return;
      }

      const emit = (detail: string) => {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('ump-player-command', { detail }));
      };

      if (hotkeyMatches(combo, hotkeys.togglePlayPause)) return emit('toggle');
      if (hotkeyMatches(combo, hotkeys.previousTrack)) return emit('previous');
      if (hotkeyMatches(combo, hotkeys.nextTrack)) return emit('next');
      if (hotkeyMatches(combo, hotkeys.toggleRepeat)) return emit('toggle-repeat');
      if (hotkeyMatches(combo, hotkeys.seekBackward)) return emit('seek-backward');
      if (hotkeyMatches(combo, hotkeys.seekForward)) return emit('seek-forward');
      if (hotkeyMatches(combo, hotkeys.volumeDown)) return emit('volume-down');
      if (hotkeyMatches(combo, hotkeys.volumeUp)) return emit('volume-up');
      if (hotkeyMatches(combo, hotkeys.speedDown)) return emit('speed-down');
      if (hotkeyMatches(combo, hotkeys.speedUp)) return emit('speed-up');
      if (hotkeyMatches(combo, hotkeys.speedReset)) return emit('speed-reset');
      if (hotkeyMatches(combo, hotkeys.toggleMute)) return emit('toggle-mute');
      if (hotkeyMatches(combo, hotkeys.toggleFullscreen)) return emit('toggle-fullscreen');
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [hotkeys, showSettings]);

  useEffect(() => {
    const updateSidebarConstraints = () => {
      const max = Math.max(280, Math.floor(window.innerWidth * 0.42));
      const min = 260;
      setSidebarWidth((value) => Math.max(min, Math.min(max, value)));
    };

    updateSidebarConstraints();
    window.addEventListener('resize', updateSidebarConstraints);
    return () => window.removeEventListener('resize', updateSidebarConstraints);
  }, []);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const min = 260;
      const max = Math.max(280, Math.floor(window.innerWidth * 0.42));
      setSidebarWidth(Math.max(min, Math.min(max, event.clientX - 12)));
    };

    const onMouseUp = () => setIsResizing(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  return (
    <div className="app-shell flex h-screen flex-col text-white">
      <Notifications />

      <Header
        onToggleSidebar={() => dispatch(toggleSidebar())}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main className="flex min-h-0 flex-1 gap-[6px] px-[6px] pb-[6px] pt-[6px]">
        {isSidebarOpen && (
          <div className="relative h-full shrink-0 sidebar-panel" style={{ width: sidebarWidth }}>
            <div className="glass-panel h-full overflow-hidden rounded-2xl">
              <Sidebar />
            </div>

            <button
              type="button"
              aria-label="Resize sidebar"
              className="absolute right-1 top-1/2 h-24 w-2.5 -translate-y-1/2 cursor-col-resize rounded-full bg-white/10 transition hover:bg-white/25"
              onMouseDown={() => setIsResizing(true)}
            />
          </div>
        )}

        <section className="relative min-w-0 flex-1">
          <Player />
        </section>
      </main>

      <Suspense
        fallback={
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/50 text-sm text-white/75">
            {t.appLoading}
          </div>
        }
      >
        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      </Suspense>
    </div>
  );
}

export default App;
