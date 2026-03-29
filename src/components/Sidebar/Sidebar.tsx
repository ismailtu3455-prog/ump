import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import {
  addFilesToPlaylist,
  createPlaylist,
  createPlaylistWithFiles,
  deletePlaylist,
  removeFileFromPlaylist,
  renamePlaylist,
  setActivePlaylist,
  setCurrentIndex,
  setSearchQuery,
  toggleFavorite,
} from '@store/playlistSlice';
import { setCurrentFile, setIsPlaying } from '@store/playerSlice';
import { addNotification, setAutoSaveOnAdd } from '@store/uiSlice';
import { createMediaFileFromFile, createMediaFileFromPath, generateId } from '@utils/fileUtils';
import { saveSettingsPatch } from '@utils/settingsStorage';
import { translations } from '@utils/translations';

type SaveProgressPayload = {
  playlistName: string;
  processed: number;
  total: number;
  copiedCount: number;
  done: boolean;
};

function Sidebar() {
  const dispatch = useAppDispatch();

  const playlists = useAppSelector((state) => state.playlist.playlists);
  const activePlaylistId = useAppSelector((state) => state.playlist.activePlaylistId);
  const searchQuery = useAppSelector((state) => state.playlist.searchQuery);
  const currentFile = useAppSelector((state) => state.player.currentFile);
  const language = useAppSelector((state) => state.ui.language);
  const autoSaveOnAdd = useAppSelector((state) => state.ui.autoSaveOnAdd);
  const t = translations[language];

  const [isPlaylistsOpen, setIsPlaylistsOpen] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [copyProgress, setCopyProgress] = useState<SaveProgressPayload | null>(null);
  const [isCopyProgressHidden, setIsCopyProgressHidden] = useState(false);
  const [dropTargetPlaylistId, setDropTargetPlaylistId] = useState<string | null>(null);
  const [isFileListDropTarget, setIsFileListDropTarget] = useState(false);
  const [movingFavoriteId, setMovingFavoriteId] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileListRef = useRef<HTMLDivElement>(null);
  const movingFavoriteTimeoutRef = useRef<number | null>(null);
  const hasLoadedSavedPlaylistsRef = useRef(false);

  const activePlaylist = useMemo(() => {
    return playlists.find((playlist) => playlist.id === activePlaylistId);
  }, [activePlaylistId, playlists]);

  const filteredFiles = useMemo(() => {
    const files = activePlaylist?.files || [];
    if (!searchQuery.trim()) return files;

    return files.filter((file) => file.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [activePlaylist?.files, searchQuery]);

  const getPlaylistLabel = (playlistId: string, playlistName: string) => {
    if (playlistId === 'recent') return t.defaultPlaylist;
    return playlistName;
  };

  const playFile = (fileId: string) => {
    if (!activePlaylist) return;

    const index = activePlaylist.files.findIndex((file) => file.id === fileId);
    if (index === -1) return;

    const file = activePlaylist.files[index];
    dispatch(setCurrentIndex(index));
    dispatch(setCurrentFile(file));
    dispatch(setIsPlaying(file.type !== 'image'));
  };

  const handleSelectPlaylist = (playlistId: string) => {
    if (!playlists.some((playlist) => playlist.id === playlistId)) return;

    // Changing playlist should not interrupt current playback.
    dispatch(setActivePlaylist(playlistId));
    dispatch(setCurrentIndex(-1));
  };

  const addMediaFilesToPlaylist = (targetPlaylistId: string, files: ReturnType<typeof createMediaFileFromFile>[]) => {
    const mediaFiles = files.filter((file): file is NonNullable<typeof file> => Boolean(file));
    if (mediaFiles.length === 0) return;

    dispatch(addFilesToPlaylist({ playlistId: targetPlaylistId, files: mediaFiles }));

    if (autoSaveOnAdd) {
      const playlistName = playlists.find((playlist) => playlist.id === targetPlaylistId)?.name || 'recent';
      const localFiles = mediaFiles.filter((file) => !file.isBlob && !file.path.startsWith('blob:'));
      if (localFiles.length > 0) {
        window.electronAPI?.saveFilesToPlaylist(playlistName, localFiles).catch(() => undefined);
      }
    }

    if (targetPlaylistId === activePlaylistId && !currentFile) {
      dispatch(setCurrentIndex(0));
      dispatch(setCurrentFile(mediaFiles[0]));
      dispatch(setIsPlaying(mediaFiles[0].type !== 'image'));
    }

    dispatch(
      addNotification({
        type: 'success',
        title: t.fileAdded,
        message: `${mediaFiles.length} ${t.filesCount}`,
      })
    );
  };

  const addDroppedFilesToPlaylist = (targetPlaylistId: string, files: File[]) => {
    const mediaFiles = files.map((file) => createMediaFileFromFile(file));
    addMediaFilesToPlaylist(targetPlaylistId, mediaFiles);
  };

  const addDraggedFileToPlaylist = (targetPlaylistId: string, event: React.DragEvent<HTMLElement>) => {
    const fileId = event.dataTransfer.getData('application/x-ump-file-id');
    if (!fileId || !activePlaylist) return false;

    const sourceFile = activePlaylist.files.find((file) => file.id === fileId);
    if (!sourceFile) return false;

    if (targetPlaylistId === activePlaylistId) return true;

    addMediaFilesToPlaylist(targetPlaylistId, [
      {
        ...sourceFile,
        id: generateId(),
        addedAt: Date.now(),
      },
    ]);

    return true;
  };

  const handleFavoriteClick = (fileId: string) => {
    const file = activePlaylist?.files.find((item) => item.id === fileId);
    const willMoveToTop = Boolean(file && !file.isFavorite);

    dispatch(toggleFavorite({ playlistId: activePlaylistId, fileId }));

    if (!willMoveToTop) return;

    setMovingFavoriteId(fileId);
    if (movingFavoriteTimeoutRef.current) {
      window.clearTimeout(movingFavoriteTimeoutRef.current);
    }

    movingFavoriteTimeoutRef.current = window.setTimeout(() => {
      setMovingFavoriteId(null);
      movingFavoriteTimeoutRef.current = null;
    }, 280);

    fileListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openFileDialog = () => {
    window.electronAPI?.openFileDialog();
  };

  const handleFolderPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList).map((file) => createMediaFileFromFile(file));
    const validCount = files.filter(Boolean).length;

    if (validCount === 0) {
      event.target.value = '';
      return;
    }

    addMediaFilesToPlaylist(activePlaylistId, files);

    event.target.value = '';
  };

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;

    dispatch(createPlaylist(newPlaylistName));
    dispatch(
      addNotification({
        type: 'success',
        title: t.playlistCreated,
        message: newPlaylistName.trim(),
      })
    );

    setNewPlaylistName('');
    setShowCreateModal(false);
  };

  const handleRenamePlaylist = (playlistId: string, oldName: string) => {
    const nextName = window.prompt(t.renamePlaylist, oldName);
    if (!nextName || !nextName.trim() || nextName.trim() === oldName.trim()) return;

    dispatch(renamePlaylist({ playlistId, newName: nextName.trim() }));
  };

  const handleDeletePlaylist = async (playlistId: string, playlistName: string, isSystem?: boolean) => {
    if (isSystem) return;

    const ok = window.confirm(`${t.deletePlaylist}: ${playlistName}?`);
    if (!ok) return;

    dispatch(deletePlaylist(playlistId));

    const result = await window.electronAPI?.deletePlaylistFolder(playlistName).catch(() => null);
    if (result && result.success === false) {
      dispatch(
        addNotification({
          type: 'warning',
          title: t.error,
          message: result.error || t.error,
        })
      );
    }

    dispatch(
      addNotification({
        type: 'info',
        title: t.playlistDeleted,
        message: playlistName,
      })
    );
  };

  const savePlaylist = async (playlistId: string) => {
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist || playlist.isSystem) return;

    const localFiles = playlist.files.filter((file) => !file.path.startsWith('blob:') && !file.isBlob);
    if (localFiles.length === 0) {
      dispatch(
        addNotification({
          type: 'warning',
          title: t.error,
          message: language === 'ru' ? 'Нет локальных файлов для сохранения' : 'No local files to save',
        })
      );
      return;
    }

    setIsCopyProgressHidden(false);
    setCopyProgress({
      playlistName: playlist.name,
      processed: 0,
      total: localFiles.length,
      copiedCount: 0,
      done: false,
    });

    const result = await window.electronAPI?.saveFilesToPlaylist(playlist.name, localFiles).catch(() => null);

    if (result?.success) {
      dispatch(
        addNotification({
          type: 'success',
          title: t.copyDone,
          message: `${result.copiedCount ?? 0} ${t.filesCount}`,
        })
      );
      return;
    }

    dispatch(
      addNotification({
        type: 'error',
        title: t.error,
        message: result?.error || t.error,
      })
    );
  };

  useEffect(() => {
    const handleProgress = (payload: SaveProgressPayload) => {
      if (!payload || typeof payload !== 'object') return;

      setCopyProgress({
        playlistName: payload.playlistName,
        processed: payload.processed,
        total: payload.total,
        copiedCount: payload.copiedCount,
        done: Boolean(payload.done),
      });

      if (payload.done) {
        window.setTimeout(() => {
          setCopyProgress((value) => (value?.done ? null : value));
        }, 3200);
      }
    };

    window.electronAPI?.on('playlist-save-progress', handleProgress);
    return () => {
      window.electronAPI?.off('playlist-save-progress', handleProgress);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (movingFavoriteTimeoutRef.current) {
        window.clearTimeout(movingFavoriteTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (hasLoadedSavedPlaylistsRef.current) return;
    hasLoadedSavedPlaylistsRef.current = true;

    const loadSavedPlaylists = async () => {
      const result = await window.electronAPI?.loadSavedPlaylists().catch(() => null);
      if (!result?.success || !Array.isArray(result.playlists)) return;

      for (const playlistData of result.playlists) {
        const exists = playlists.find((playlist) => playlist.name === playlistData.name);
        if (exists) continue;

        const files = Array.isArray(playlistData.savedFiles)
          ? playlistData.savedFiles
              .map((saved: { path?: string; name?: string }) =>
                saved.path ? createMediaFileFromPath(saved.path) : null
              )
              .filter(
                (
                  file: ReturnType<typeof createMediaFileFromPath>
                ): file is NonNullable<ReturnType<typeof createMediaFileFromPath>> => Boolean(file)
              )
          : [];

        dispatch(
          createPlaylistWithFiles({
            playlist: {
              id: `saved_${generateId()}`,
              name: playlistData.name,
              files,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              isSystem: false,
            },
          })
        );
      }
    };

    loadSavedPlaylists().catch(() => undefined);
  }, [dispatch, playlists]);

  return (
    <aside className="sidebar-enter flex h-full w-full flex-col gap-3 overflow-x-hidden px-3 py-3">
      <div
        className={`glass-panel rounded-2xl p-3 ${dropTargetPlaylistId === 'recent' ? 'ring-2 ring-sky-300/60' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          setDropTargetPlaylistId('recent');
        }}
        onDragLeave={() => setDropTargetPlaylistId(null)}
        onDrop={(event) => {
          event.preventDefault();
          setDropTargetPlaylistId(null);

          if (addDraggedFileToPlaylist('recent', event)) return;

          const dropped = Array.from(event.dataTransfer.files);
          if (dropped.length > 0) {
            addDroppedFilesToPlaylist('recent', dropped);
          }
        }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => dispatch(setSearchQuery(event.target.value))}
          placeholder={t.searchPlaylist}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/25"
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={openFileDialog}
            className="interactive-btn rounded-xl px-3 py-2 text-xs font-medium text-white/90"
          >
            {t.addFiles}
          </button>

          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="interactive-btn rounded-xl px-3 py-2 text-xs font-medium text-white/90"
          >
            {t.addFolder}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            const next = !autoSaveOnAdd;
            dispatch(setAutoSaveOnAdd(next));
            saveSettingsPatch({ autoSaveOnAdd: next });
          }}
          className={`interactive-btn mt-2 w-full rounded-xl px-3 py-2 text-xs font-medium ${
            autoSaveOnAdd
              ? 'border-emerald-300/35 bg-emerald-500/20 text-emerald-100'
              : 'text-white/85'
          }`}
        >
          {language === 'ru'
            ? `Автосохранение: ${autoSaveOnAdd ? 'Вкл' : 'Выкл'}`
            : `Auto-save: ${autoSaveOnAdd ? 'On' : 'Off'}`}
        </button>

        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-ignore webkitdirectory is supported in Electron Chromium
          webkitdirectory=""
          onChange={handleFolderPick}
          className="hidden"
        />
      </div>

      <div className="glass-panel rounded-2xl p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsPlaylistsOpen((value) => !value)}
            className="tooltip-trigger flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-white/90 hover:bg-white/10"
            data-tooltip={isPlaylistsOpen ? t.collapsePlaylists : t.expandPlaylists}
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 transition ${isPlaylistsOpen ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m8 5 8 7-8 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{t.playlists}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="tooltip-trigger interactive-btn rounded-lg px-2 py-1 text-white/90"
            data-tooltip={t.addPlaylist}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {isPlaylistsOpen && (
          <div className="max-h-[28vh] space-y-2 overflow-x-hidden overflow-y-auto pr-1">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className={`playlist-card rounded-xl border px-3 py-2 transition ${
                  dropTargetPlaylistId === playlist.id
                    ? 'border-sky-300/70 bg-sky-500/15'
                    : playlist.id === activePlaylistId
                      ? 'border-white/25 bg-white/15'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = 'copy';
                  setDropTargetPlaylistId(playlist.id);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDropTargetPlaylistId(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDropTargetPlaylistId(null);

                  if (addDraggedFileToPlaylist(playlist.id, event)) return;

                  const dropped = Array.from(event.dataTransfer.files);
                  if (dropped.length > 0) {
                    addDroppedFilesToPlaylist(playlist.id, dropped);
                  }
                }}
              >
                <button
                  type="button"
                  onClick={() => handleSelectPlaylist(playlist.id)}
                  className="w-full text-left"
                >
                  <p className="truncate text-sm font-medium text-white">
                    {getPlaylistLabel(playlist.id, playlist.name)}
                  </p>
                  <p className="text-xs text-white/55">
                    {playlist.files.length} {t.filesCount}
                  </p>
                </button>

                {!playlist.isSystem && (
                  <div className="mt-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleRenamePlaylist(playlist.id, playlist.name);
                      }}
                      className="tooltip-trigger rounded-md bg-white/10 px-2 py-1 text-white/80 transition hover:bg-white/15"
                      data-tooltip={t.renamePlaylist}
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m4 20 4.5-1 9.8-9.8a1.4 1.4 0 0 0 0-2L16.8 5.7a1.4 1.4 0 0 0-2 0L5 15.5 4 20Z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        savePlaylist(playlist.id).catch(() => undefined);
                      }}
                      className="tooltip-trigger rounded-md bg-white/10 px-2 py-1 text-white/80 transition hover:bg-white/15"
                      data-tooltip={t.save}
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 16v3h14v-3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDeletePlaylist(playlist.id, playlist.name, playlist.isSystem).catch(() => undefined);
                      }}
                      className="tooltip-trigger rounded-md bg-rose-500/15 px-2 py-1 text-rose-100 transition hover:bg-rose-500/25"
                      data-tooltip={t.deletePlaylist}
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V5h6v2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel flex min-h-0 flex-1 flex-col rounded-2xl p-3">
        <p className="mb-3 text-sm font-semibold text-white">
          {getPlaylistLabel(activePlaylist?.id || 'recent', activePlaylist?.name || t.defaultPlaylist)}
        </p>

        <div
          ref={fileListRef}
          className={`min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto pr-1 ${
            isFileListDropTarget ? 'rounded-xl ring-2 ring-sky-300/60' : ''
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setIsFileListDropTarget(true);
          }}
          onDragLeave={() => setIsFileListDropTarget(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsFileListDropTarget(false);

            if (addDraggedFileToPlaylist(activePlaylistId, event)) return;

            const dropped = Array.from(event.dataTransfer.files);
            if (dropped.length > 0) {
              addDroppedFilesToPlaylist(activePlaylistId, dropped);
            }
          }}
        >
          {filteredFiles.map((file, index) => {
            const isActive = file.id === currentFile?.id;

            return (
              <div
                key={file.id}
                className={`file-row group flex items-center gap-2 rounded-xl px-2 py-2 transition ${
                  isActive ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'copy';
                  event.dataTransfer.setData('application/x-ump-file-id', file.id);
                  event.dataTransfer.setData('text/plain', file.name);
                }}
                onDragEnd={() => {
                  setDropTargetPlaylistId(null);
                  setIsFileListDropTarget(false);
                }}
              >
                <button
                  type="button"
                  onClick={() => playFile(file.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="w-5 text-center text-xs text-white/50">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{file.name}</p>
                    <p className="text-[11px] uppercase text-white/45">{file.format}</p>
                  </div>
                </button>

                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleFavoriteClick(file.id);
                  }}
                  className={`tooltip-trigger rounded-md px-1.5 py-1 text-white/70 transition hover:bg-white/10 ${
                    movingFavoriteId === file.id ? 'favorite-move' : ''
                  }`}
                  data-tooltip={t.toggleFavorite}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill={file.isFavorite ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      d="m12 20-1.2-1.1C6.2 14.7 3 11.8 3 8.2A4.2 4.2 0 0 1 7.2 4C9 4 10.7 4.8 12 6.1A6.4 6.4 0 0 1 16.8 4 4.2 4.2 0 0 1 21 8.2c0 3.6-3.2 6.5-7.8 10.7L12 20Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const isCurrent = file.id === currentFile?.id;
                    const remainingFiles = (activePlaylist?.files || []).filter((item) => item.id !== file.id);

                    dispatch(removeFileFromPlaylist({ playlistId: activePlaylistId, fileId: file.id }));

                    if (isCurrent) {
                      if (remainingFiles.length === 0) {
                        dispatch(setCurrentIndex(-1));
                        dispatch(setCurrentFile(null));
                        dispatch(setIsPlaying(false));
                        return;
                      }

                      const nextIndex = Math.min(index, remainingFiles.length - 1);
                      const nextFile = remainingFiles[nextIndex];
                      dispatch(setCurrentIndex(nextIndex));
                      dispatch(setCurrentFile(nextFile));
                      dispatch(setIsPlaying(nextFile.type !== 'image'));
                    }
                  }}
                  className="tooltip-trigger rounded-md px-1.5 py-1 text-white/70 transition hover:bg-rose-500/25 hover:text-rose-100"
                  data-tooltip={t.removeFile}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V5h6v2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => window.electronAPI?.openPlaylistsFolder()}
          className="interactive-btn mt-auto w-full rounded-xl px-3 py-2 text-xs text-white/90"
        >
          {t.openPlaylistsFolder}
        </button>
      </div>

      {copyProgress && !isCopyProgressHidden && (
        <div className="glass-panel fixed right-5 top-[88px] z-[85] w-[310px] rounded-2xl p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-white">{t.copyProgress}</p>
            <button
              type="button"
              onClick={() => setIsCopyProgressHidden(true)}
              className="interactive-btn rounded-md px-2 py-1 text-[11px] text-white/80"
            >
              {t.hideProgress}
            </button>
          </div>

          <p className="truncate text-xs text-white/70">{copyProgress.playlistName}</p>
          <p className="mt-1 text-xs text-white/70">
            {copyProgress.processed}/{copyProgress.total} · {t.copiedCount}: {copyProgress.copiedCount}
          </p>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white/70 transition-all"
              style={{
                width:
                  copyProgress.total > 0
                    ? `${Math.min(100, (copyProgress.processed / copyProgress.total) * 100)}%`
                    : '0%',
              }}
            />
          </div>
        </div>
      )}

      {copyProgress && isCopyProgressHidden && !copyProgress.done && (
        <button
          type="button"
          onClick={() => setIsCopyProgressHidden(false)}
          className="interactive-btn fixed right-5 top-[88px] z-[85] rounded-xl px-3 py-2 text-xs text-white/85"
        >
          {t.showProgress}
        </button>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm">
          <div className="glass-panel w-[380px] rounded-2xl p-4">
            <p className="text-sm font-semibold text-white">{t.newPlaylist}</p>
            <input
              value={newPlaylistName}
              onChange={(event) => setNewPlaylistName(event.target.value)}
              placeholder={t.playlistName}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/45 focus:border-white/25"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCreatePlaylist();
              }}
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewPlaylistName('');
                }}
                className="interactive-btn rounded-xl px-3 py-2 text-xs text-white/80"
              >
                {t.cancel}
              </button>

              <button
                type="button"
                onClick={handleCreatePlaylist}
                className="rounded-xl bg-white/20 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/30"
              >
                {t.create}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;


