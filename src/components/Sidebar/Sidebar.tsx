import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { addNotification } from '@store/uiSlice';
import { createMediaFileFromFile, createMediaFileFromPath, generateId } from '@utils/fileUtils';
import { translations } from '@utils/translations';
import type { MediaFile } from '@/types';

type SaveProgressPayload = {
  playlistName: string;
  processed: number;
  total: number;
  copiedCount: number;
  done: boolean;
};

type ImportPreviewData = {
  playlistCount: number;
  totalFiles: number;
  playlists: Array<{
    name: string;
    fileCount: number;
    files: Array<{
      name: string;
      format?: string;
      type?: string;
    }>;
  }>;
};

type MediaDraft = ReturnType<typeof createMediaFileFromFile> | ReturnType<typeof createMediaFileFromPath>;

const ARCHIVE_UPLOAD_URL = 'https://gofile.io/uploadFiles';
const MIN_PLAYLISTS_PANEL_HEIGHT = 140;
const MIN_FILES_PANEL_HEIGHT = 180;
const SPLIT_RESIZER_HEIGHT = 10;
const DEFAULT_PLAYLISTS_PANEL_HEIGHT = 250;
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
  const [playlistsPanelHeight, setPlaylistsPanelHeight] = useState(DEFAULT_PLAYLISTS_PANEL_HEIGHT);
  const [isResizingPanelSplit, setIsResizingPanelSplit] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddChoiceModal, setShowAddChoiceModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showTransferHubModal, setShowTransferHubModal] = useState(false);
  const [vkVideoUrlInput, setVkVideoUrlInput] = useState('');
  const [vkVideoErrorText, setVkVideoErrorText] = useState('');
  const [isResolvingVkVideo, setIsResolvingVkVideo] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [copyProgress, setCopyProgress] = useState<SaveProgressPayload | null>(null);
  const [isCopyProgressHidden, setIsCopyProgressHidden] = useState(false);
  const [dropTargetPlaylistId, setDropTargetPlaylistId] = useState<string | null>(null);
  const [isFileListDropTarget, setIsFileListDropTarget] = useState(false);
  const [movingFavoriteId, setMovingFavoriteId] = useState<string | null>(null);
  const [selectedExportPlaylistId, setSelectedExportPlaylistId] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportErrorText, setExportErrorText] = useState('');
  const [exportArchivePath, setExportArchivePath] = useState('');
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importArchivePath, setImportArchivePath] = useState('');
  const [importArchiveName, setImportArchiveName] = useState('');
  const [importPreviewToken, setImportPreviewToken] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);
  const [importErrorText, setImportErrorText] = useState('');
  const importArchiveInputRef = useRef<HTMLInputElement>(null);
  const panelStackRef = useRef<HTMLDivElement>(null);
  const fileListRef = useRef<HTMLDivElement>(null);
  const movingFavoriteTimeoutRef = useRef<number | null>(null);
  const hasLoadedSavedPlaylistsRef = useRef(false);

  const activePlaylist = useMemo(() => {
    return playlists.find((playlist) => playlist.id === activePlaylistId);
  }, [activePlaylistId, playlists]);

  const clampPlaylistsPanelHeight = useCallback((value: number) => {
    const stackHeight = panelStackRef.current?.getBoundingClientRect().height ?? 0;
    if (stackHeight <= 0) {
      return Math.max(MIN_PLAYLISTS_PANEL_HEIGHT, value);
    }

    const maxHeight = Math.max(
      MIN_PLAYLISTS_PANEL_HEIGHT,
      stackHeight - MIN_FILES_PANEL_HEIGHT - SPLIT_RESIZER_HEIGHT
    );
    return Math.max(MIN_PLAYLISTS_PANEL_HEIGHT, Math.min(maxHeight, value));
  }, []);

  const filteredFiles = useMemo(() => {
    const files = activePlaylist?.files || [];
    if (!searchQuery.trim()) return files;

    return files.filter((file) => file.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [activePlaylist?.files, searchQuery]);

  const exportablePlaylists = useMemo(() => {
    return playlists.filter((playlist) =>
      playlist.files.some((file) => !file.path.startsWith('blob:') && !file.isBlob)
    );
  }, [playlists]);

  const uiText = useMemo(() => {
    if (language === 'ru') {
      return {
        addButton: 'Добавить',
        addChoiceTitle: 'Что добавить?',
        addFilesChoice: 'Добавить файлы',
        addFolderChoice: 'Добавить папку',
        pasteButton: 'Вставить',
        pasteTitle: 'Вставьте ссылку из YouTube или VK',
        pasteHint:
          'YouTube: Поделиться -> Вставить -> Копировать. VK: Поделиться -> Вставить -> Копировать.',
        pasteInputPlaceholder: 'Вставьте ссылку или embed-код...',
        exportImportButton: 'ЭКСПОРТ/ИМПОРТ',
        transferTitle: 'Экспорт / Импорт',
        transferExport: 'Экспорт',
        transferImport: 'Импорт',
        exportTitle: 'Экспорт плейлиста в архив',
        importTitle: 'Импорт плейлиста из архива',
        importFromLinkOrFile: 'Вставьте ссылку или выберите локальный архив',
        importFileChoose: 'Выбрать архив',
        importPreviewEmpty: 'Сначала получите превью',
        importPreviewSection: 'Превью импорта',
        vkLinkLabel: 'Ссылка YouTube/VK',
        vkLinkPlaceholder: 'https://vk.com/video... / https://youtu.be/...',
        vkRunButton: 'Запустить в плеере',
        vkRunLoading: 'Загрузка...',
        vkHint: 'Вставьте ссылку или embed-код (YouTube/VK).',
        vkUrlEmpty: 'Вставьте ссылку на YouTube или VK видео',
        vkRunDone: 'Видео запущено',
      };
    }

    return {
      addButton: 'Add',
      addChoiceTitle: 'What to add?',
      addFilesChoice: 'Add files',
      addFolderChoice: 'Add folder',
      pasteButton: 'Paste',
      pasteTitle: 'Paste YouTube or VK link',
      pasteHint:
        'YouTube: Share -> Embed -> Copy. VK: Share -> Embed -> Copy.',
      pasteInputPlaceholder: 'Paste URL or embed code...',
      exportImportButton: 'EXPORT/IMPORT',
      transferTitle: 'Export / Import',
      transferExport: 'Export',
      transferImport: 'Import',
      exportTitle: 'Export playlist to archive',
      importTitle: 'Import playlist from archive',
      importFromLinkOrFile: 'Paste link or choose local archive',
      importFileChoose: 'Choose archive',
      importPreviewEmpty: 'Build preview first',
      importPreviewSection: 'Import preview',
      vkLinkLabel: 'YouTube/VK URL',
      vkLinkPlaceholder: 'https://vk.com/video... / https://youtu.be/...',
      vkRunButton: 'Play in player',
      vkRunLoading: 'Loading...',
      vkHint: 'Paste URL or embed code (YouTube/VK).',
      vkUrlEmpty: 'Paste YouTube or VK link',
      vkRunDone: 'Video started',
    };
  }, [language]);

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

  const addMediaFilesToPlaylist = (targetPlaylistId: string, files: MediaDraft[]) => {
    const mediaFiles = files.filter((file): file is NonNullable<MediaDraft> => Boolean(file));
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

  const pickMediaFolder = async () => {
    const result = await window.electronAPI?.pickMediaFolder().catch(() => null);

    if (!result) {
      dispatch(
        addNotification({
          type: 'error',
          title: t.error,
          message: t.error,
        })
      );
      return;
    }

    if (result.canceled) {
      return;
    }

    if (!result.success) {
      dispatch(
        addNotification({
          type: 'error',
          title: t.error,
          message: result.error || t.error,
        })
      );
      return;
    }

    const files = Array.isArray(result.files)
      ? result.files.map((filePath) => createMediaFileFromPath(filePath))
      : [];

    const validCount = files.filter(Boolean).length;
    if (validCount === 0) {
      dispatch(
        addNotification({
          type: 'warning',
          title: t.error,
          message: language === 'ru'
            ? 'Р’ РІС‹Р±СЂР°РЅРЅРѕР№ РїР°РїРєРµ РЅРµ РЅР°Р№РґРµРЅРѕ РјРµРґРёР°С„Р°Р№Р»РѕРІ'
            : 'No media files were found in the selected folder',
        })
      );
      return;
    }

    addMediaFilesToPlaylist(activePlaylistId, files);
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
          message: 'No local files to save',
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

  const createRemoteVkMediaFile = (playbackUrl: string): MediaFile => {
    const parsedViaUtils = createMediaFileFromPath(playbackUrl);
    if (parsedViaUtils && parsedViaUtils.type === 'video') {
      return { ...parsedViaUtils, id: generateId(), addedAt: Date.now(), isBlob: false };
    }

    let fileName = '';
    let format = 'mp4';

    try {
      const parsed = new URL(playbackUrl);
      fileName = decodeURIComponent(parsed.pathname.split('/').pop() || '').trim();
      const extMatch = fileName.match(/\.([a-z0-9]{2,5})$/i);
      if (extMatch?.[1]) {
        format = extMatch[1].toLowerCase();
      } else if (parsed.pathname.toLowerCase().includes('.m3u8')) {
        format = 'm3u8';
      }
    } catch {
      // Keep defaults when URL parser fails.
    }

    if (!fileName) {
      fileName = `vk-video-${Date.now()}.${format}`;
    }

    return {
      id: generateId(),
      name: fileName,
      path: playbackUrl,
      type: 'video',
      format,
      size: 0,
      addedAt: Date.now(),
      isBlob: false,
    };
  };

  const closePasteModal = useCallback(() => {
    setShowPasteModal(false);
    setVkVideoErrorText('');
    setIsResolvingVkVideo(false);
  }, []);

  const openPasteModal = useCallback(() => {
    setVkVideoErrorText('');
    setVkVideoUrlInput('');
    setIsResolvingVkVideo(false);
    setShowPasteModal(true);
  }, []);

  const closeAddChoiceModal = () => {
    setShowAddChoiceModal(false);
  };

  const openAddChoiceModal = () => {
    setShowAddChoiceModal(true);
  };

  const openTransferHubModal = () => {
    setShowTransferHubModal(true);
  };

  const closeTransferHubModal = () => {
    setShowTransferHubModal(false);
  };

  const openExportFromHub = () => {
    closeTransferHubModal();
    openExportModal();
  };

  const openImportFromHub = () => {
    closeTransferHubModal();
    openImportModal();
  };

  const runVkVideoInPlayer = async () => {
    const sourceUrl = vkVideoUrlInput.trim();
    if (!sourceUrl) {
      setVkVideoErrorText(uiText.vkUrlEmpty);
      return;
    }

    setIsResolvingVkVideo(true);
    setVkVideoErrorText('');

    try {
      const result = await window.electronAPI?.resolveVkVideoUrl(sourceUrl).catch(() => null);

      if (!result?.success || !result.playableUrl) {
        setVkVideoErrorText(String(result?.error || t.error));
        return;
      }

      const playbackUrl = String(result.playableUrl);
      const currentPlaylist = playlists.find((playlist) => playlist.id === activePlaylistId);
      const currentFiles = Array.isArray(currentPlaylist?.files) ? currentPlaylist.files : [];
      const existingIndex = currentFiles.findIndex((file) => file.path === playbackUrl);

      if (existingIndex >= 0) {
        const existingFile = currentFiles[existingIndex];
        dispatch(setCurrentIndex(existingIndex));
        dispatch(setCurrentFile(existingFile));
        dispatch(setIsPlaying(true));
      } else {
        const remoteFile = createRemoteVkMediaFile(playbackUrl);
        dispatch(addFilesToPlaylist({ playlistId: activePlaylistId, files: [remoteFile] }));
        dispatch(setCurrentIndex(currentFiles.length));
        dispatch(setCurrentFile(remoteFile));
        dispatch(setIsPlaying(true));
      }

      dispatch(
        addNotification({
          type: 'success',
          title: uiText.vkRunDone,
          message: playbackUrl,
        })
      );

      setVkVideoUrlInput('');
      closePasteModal();
    } catch (error: unknown) {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message || t.error)
          : String(error || t.error);
      setVkVideoErrorText(message);
    } finally {
      setIsResolvingVkVideo(false);
    }
  };

  const openDownloadSource = async (url: string) => {
    const result = await window.electronAPI?.openUrl(url).catch(() => null);
    if (!result?.success) {
      dispatch(
        addNotification({
          type: 'error',
          title: t.error,
          message: result?.error || t.error,
        })
      );
      return;
    }

    closePasteModal();
  };

  const openExportModal = () => {
    if (exportablePlaylists.length === 0) {
      dispatch(
        addNotification({
          type: 'warning',
          title: t.error,
          message: t.exportNoPlaylist,
        })
      );
      return;
    }

    const initialPlaylistId = exportablePlaylists[0]?.id || '';
    setSelectedExportPlaylistId(initialPlaylistId);
    setExportErrorText('');
    setExportArchivePath('');
    setShowExportModal(true);
  };

  const closeExportModal = () => {
    if (isExporting) return;
    setShowExportModal(false);
    setExportErrorText('');
    setExportArchivePath('');
  };

  const runExportPlaylist = async () => {
    if (!selectedExportPlaylistId) {
      setExportErrorText(t.exportNoPlaylistSelected);
      return;
    }

    const playlist = playlists.find((item) => item.id === selectedExportPlaylistId);
    if (!playlist) {
      setExportErrorText(t.exportNoPlaylistSelected);
      return;
    }

    setIsExporting(true);
    setExportErrorText('');
    setExportArchivePath('');

    try {
      const result = await window.electronAPI
        ?.exportPlaylistArchive({
          playlistName: playlist.name,
          files: playlist.files.map((file) => ({
            path: file.path,
            name: file.name,
            type: file.type,
            format: file.format,
          })),
        })
        .catch(() => null);

      if (!result) {
        setExportErrorText(t.exportFailed);
        return;
      }

      if (result.canceled) {
        return;
      }

      if (!result.success) {
        setExportErrorText(result.error || t.exportFailed);
        return;
      }

      const savedPath = String(result.archivePath || '');
      setExportArchivePath(savedPath);

      dispatch(
        addNotification({
          type: 'success',
          title: t.exportDoneTitle,
          message: savedPath || playlist.name,
        })
      );
    } finally {
      setIsExporting(false);
    }
  };

  const copyExportPath = async () => {
    if (!exportArchivePath) return;

    try {
      await navigator.clipboard.writeText(exportArchivePath);
      dispatch(
        addNotification({
          type: 'success',
          title: t.exportDoneTitle,
          message: t.exportGuideCopyPathDone,
        })
      );
    } catch {
      dispatch(
        addNotification({
          type: 'error',
          title: t.error,
          message: t.error,
        })
      );
    }
  };

  const resetImportState = () => {
    if (importPreviewToken) {
      window.electronAPI?.discardPlaylistImportPreview(importPreviewToken).catch(() => undefined);
    }

    setImportUrl('');
    setImportArchivePath('');
    setImportArchiveName('');
    setImportPreviewToken('');
    setImportPreview(null);
    setImportErrorText('');
    if (importArchiveInputRef.current) {
      importArchiveInputRef.current.value = '';
    }
  };

  const closeImportModal = async () => {
    if (isPreviewingImport || isApplyingImport) return;

    if (importPreviewToken) {
      await window.electronAPI?.discardPlaylistImportPreview(importPreviewToken).catch(() => undefined);
    }

    resetImportState();
    setShowImportModal(false);
  };

  const openImportModal = () => {
    resetImportState();
    setShowImportModal(true);
  };

  const handleImportArchivePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (importPreviewToken) {
      window.electronAPI?.discardPlaylistImportPreview(importPreviewToken).catch(() => undefined);
    }

    const electronFilePath = (file as File & { path?: string }).path || '';
    if (!electronFilePath) {
      setImportErrorText(t.importSourceEmpty);
      return;
    }

    setImportArchivePath(electronFilePath);
    setImportArchiveName(file.name || electronFilePath);
    setImportUrl('');
    setImportPreview(null);
    setImportPreviewToken('');
    setImportErrorText('');
  };

  const requestImportPreview = async () => {
    const normalizedUrl = importUrl.trim();
    const sourcePayload =
      importArchivePath
        ? { type: 'file' as const, filePath: importArchivePath }
        : normalizedUrl
          ? { type: 'url' as const, url: normalizedUrl }
          : null;

    if (!sourcePayload) {
      setImportErrorText(t.importSourceEmpty);
      return;
    }

    setIsPreviewingImport(true);
    setImportErrorText('');

    try {
      if (importPreviewToken) {
        await window.electronAPI?.discardPlaylistImportPreview(importPreviewToken).catch(() => undefined);
      }

      const result = await window.electronAPI?.previewPlaylistImport(sourcePayload).catch(() => null);
      if (!result?.success) {
        setImportPreview(null);
        setImportPreviewToken('');
        setImportErrorText(result?.error || t.importPreviewFailed);
        return;
      }

      setImportPreview(result.preview as ImportPreviewData);
      setImportPreviewToken(String(result.token || ''));

      dispatch(
        addNotification({
          type: 'success',
          title: t.importPreviewReady,
          message: `${result.preview?.playlistCount || 0} / ${result.preview?.totalFiles || 0}`,
        })
      );
    } finally {
      setIsPreviewingImport(false);
    }
  };

  const applyImportFromPreview = async () => {
    if (!importPreviewToken) {
      setImportErrorText(uiText.importPreviewEmpty);
      return;
    }

    setIsApplyingImport(true);
    setImportErrorText('');

    try {
      const result = await window.electronAPI?.applyPlaylistImport(importPreviewToken).catch(() => null);
      if (!result?.success) {
        setImportErrorText(result?.error || t.importApplyFailed);
        return;
      }

      const imported = Array.isArray(result.importedPlaylists) ? result.importedPlaylists : [];
      for (const importedPlaylist of imported) {
        const files = Array.isArray(importedPlaylist?.savedFiles)
          ? importedPlaylist.savedFiles
              .map((saved: { path?: string }) => (saved?.path ? createMediaFileFromPath(saved.path) : null))
              .filter(
                (
                  file: ReturnType<typeof createMediaFileFromPath>
                ): file is NonNullable<ReturnType<typeof createMediaFileFromPath>> => Boolean(file)
              )
          : [];

        dispatch(
          createPlaylistWithFiles({
            playlist: {
              id: `imp_${generateId()}`,
              name: String(importedPlaylist?.name || 'Imported Playlist'),
              files,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              isSystem: false,
            },
          })
        );
      }

      dispatch(
        addNotification({
          type: 'success',
          title: t.importDoneTitle,
          message: `${result.totalFiles || 0} ${t.filesCount}`,
        })
      );

      resetImportState();
      setShowImportModal(false);
    } finally {
      setIsApplyingImport(false);
    }
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
    const handleOpenPaste = () => {
      openPasteModal();
    };

    window.addEventListener('ump-open-paste', handleOpenPaste as EventListener);
    return () => window.removeEventListener('ump-open-paste', handleOpenPaste as EventListener);
  }, [openPasteModal]);

  useEffect(() => {
    return () => {
      if (importPreviewToken) {
        window.electronAPI?.discardPlaylistImportPreview(importPreviewToken).catch(() => undefined);
      }
    };
  }, [importPreviewToken]);

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
            activate: false,
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

  useEffect(() => {
    const syncPanelHeight = () => {
      setPlaylistsPanelHeight((value) => clampPlaylistsPanelHeight(value));
    };

    syncPanelHeight();
    window.addEventListener('resize', syncPanelHeight);
    return () => window.removeEventListener('resize', syncPanelHeight);
  }, [clampPlaylistsPanelHeight]);

  useEffect(() => {
    if (!isPlaylistsOpen) {
      setIsResizingPanelSplit(false);
    }
  }, [isPlaylistsOpen]);

  useEffect(() => {
    if (!isResizingPanelSplit || !isPlaylistsOpen) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (event: MouseEvent) => {
      const panelRect = panelStackRef.current?.getBoundingClientRect();
      if (!panelRect) return;

      const rawHeight = event.clientY - panelRect.top;
      setPlaylistsPanelHeight(clampPlaylistsPanelHeight(rawHeight));
    };

    const handleMouseUp = () => {
      setIsResizingPanelSplit(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [clampPlaylistsPanelHeight, isResizingPanelSplit, isPlaylistsOpen]);

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

        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={openAddChoiceModal}
            className="interactive-btn w-full rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/90"
          >
            {uiText.addButton}
          </button>

          <button
            type="button"
            onClick={openTransferHubModal}
            className="interactive-btn w-full rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/90"
          >
            {uiText.exportImportButton}
          </button>
        </div>

        <input
          ref={importArchiveInputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={handleImportArchivePick}
          className="hidden"
        />
      </div>

      <div ref={panelStackRef} className="flex min-h-0 flex-1 flex-col">
        <div
          className="glass-panel flex flex-col rounded-2xl p-3"
          style={isPlaylistsOpen ? { height: playlistsPanelHeight } : undefined}
        >
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
            <div className="min-h-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto pr-1">
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

        {isPlaylistsOpen && (
          <button
            type="button"
            aria-label="Resize sidebar panels"
            className="group my-1 flex h-2.5 w-full cursor-row-resize items-center justify-center rounded-full"
            onMouseDown={(event) => {
              event.preventDefault();
              setIsResizingPanelSplit(true);
            }}
          >
            <span className="h-1 w-16 rounded-full bg-white/18 transition group-hover:bg-white/35" />
          </button>
        )}

        <div className="glass-panel flex min-h-[180px] flex-1 flex-col rounded-2xl p-3">
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
            {copyProgress.processed}/{copyProgress.total} | {t.copiedCount}: {copyProgress.copiedCount}
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

      {showAddChoiceModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAddChoiceModal();
            }
          }}
        >
          <div className="glass-panel w-[360px] rounded-2xl p-4" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{uiText.addChoiceTitle}</p>
              <button
                type="button"
                onClick={closeAddChoiceModal}
                className="interactive-btn rounded-lg px-2 py-1 text-xs text-white/80"
              >
                {t.close}
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  closeAddChoiceModal();
                  openFileDialog();
                }}
                className="interactive-btn w-full rounded-xl px-3 py-2 text-sm font-medium text-white/90"
              >
                {uiText.addFilesChoice}
              </button>
              <button
                type="button"
                onClick={() => {
                  closeAddChoiceModal();
                  pickMediaFolder().catch(() => undefined);
                }}
                className="interactive-btn w-full rounded-xl px-3 py-2 text-sm font-medium text-white/90"
              >
                {uiText.addFolderChoice}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransferHubModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeTransferHubModal();
            }
          }}
        >
          <div className="glass-panel w-[360px] rounded-2xl p-4" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{uiText.transferTitle}</p>
              <button
                type="button"
                onClick={closeTransferHubModal}
                className="interactive-btn rounded-lg px-2 py-1 text-xs text-white/80"
              >
                {t.close}
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={openExportFromHub}
                className="interactive-btn w-full rounded-xl px-3 py-2 text-sm font-medium text-white/90"
              >
                {uiText.transferExport}
              </button>
              <button
                type="button"
                onClick={openImportFromHub}
                className="interactive-btn w-full rounded-xl px-3 py-2 text-sm font-medium text-white/90"
              >
                {uiText.transferImport}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasteModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePasteModal();
            }
          }}
        >
          <div className="glass-panel w-[520px] rounded-2xl p-4" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{uiText.pasteTitle}</p>
              <button
                type="button"
                onClick={closePasteModal}
                className="interactive-btn rounded-lg px-2 py-1 text-xs text-white/80"
              >
                {t.close}
              </button>
            </div>

            <div className="rounded-xl border border-white/12 bg-white/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{uiText.vkLinkLabel}</p>
              <p className="mt-1 text-xs text-white/65">{uiText.vkHint}</p>
              <p className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65">
                {uiText.pasteHint}
              </p>

              <div className="mt-2 flex items-center gap-2">
                <input
                  value={vkVideoUrlInput}
                  onChange={(event) => {
                    setVkVideoUrlInput(event.target.value);
                    if (vkVideoErrorText) setVkVideoErrorText('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      runVkVideoInPlayer().catch(() => undefined);
                    }
                  }}
                  placeholder={uiText.pasteInputPlaceholder}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/45 focus:border-white/30"
                />
                <button
                  type="button"
                  onClick={() => runVkVideoInPlayer().catch(() => undefined)}
                  disabled={isResolvingVkVideo}
                  className="interactive-btn rounded-xl px-3 py-2 text-xs font-medium text-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResolvingVkVideo ? uiText.vkRunLoading : uiText.vkRunButton}
                </button>
              </div>

              {vkVideoErrorText && (
                <p className="mt-2 break-words rounded-xl border border-rose-300/35 bg-rose-500/15 px-3 py-2 text-xs text-rose-100">
                  {vkVideoErrorText}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeExportModal();
            }
          }}
        >
          <div className="glass-panel w-[560px] rounded-2xl p-4" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{uiText.exportTitle}</p>
              <button
                type="button"
                onClick={closeExportModal}
                className="interactive-btn rounded-lg px-2 py-1 text-xs text-white/80"
                disabled={isExporting}
              >
                {t.close}
              </button>
            </div>

            <select
              value={selectedExportPlaylistId}
              onChange={(event) => setSelectedExportPlaylistId(event.target.value)}
              disabled={isExporting}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
            >
              {exportablePlaylists.map((playlist) => (
                <option key={playlist.id} value={playlist.id} className="bg-slate-900 text-white">
                  {getPlaylistLabel(playlist.id, playlist.name)}
                </option>
              ))}
            </select>

            {exportErrorText && (
              <p className="mt-2 break-words rounded-xl border border-rose-300/30 bg-rose-500/15 px-3 py-2 text-xs text-rose-100">
                {exportErrorText}
              </p>
            )}

            {exportArchivePath && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/85">
                <p className="font-medium text-white">{t.exportGuideTitle}</p>
                <p className="mt-1 text-white/70">{t.exportGuideText}</p>
                <p className="mt-2 break-all text-white/80">{exportArchivePath}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyExportPath().catch(() => undefined)}
                    className="interactive-btn rounded-xl px-3 py-2 text-xs text-white/85"
                  >
                    {t.exportGuideCopyPath}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDownloadSource(ARCHIVE_UPLOAD_URL).catch(() => undefined)}
                    className="interactive-btn rounded-xl px-3 py-2 text-xs text-white/85"
                  >
                    {t.exportGuideOpenSite}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeExportModal}
                disabled={isExporting}
                className="interactive-btn rounded-xl px-3 py-2 text-xs text-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => runExportPlaylist().catch(() => undefined)}
                disabled={isExporting}
                className="rounded-xl bg-white/20 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExporting ? t.exportingNow : t.exportNow}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeImportModal().catch(() => undefined);
            }
          }}
        >
          <div className="glass-panel w-[640px] rounded-2xl p-4" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{uiText.importTitle}</p>
              <button
                type="button"
                onClick={() => closeImportModal().catch(() => undefined)}
                className="interactive-btn rounded-lg px-2 py-1 text-xs text-white/80"
                disabled={isPreviewingImport || isApplyingImport}
              >
                {t.close}
              </button>
            </div>

            <p className="mb-2 text-xs text-white/70">{uiText.importFromLinkOrFile}</p>

            <input
              value={importUrl}
              onChange={(event) => {
                if (importPreviewToken) {
                  window.electronAPI?.discardPlaylistImportPreview(importPreviewToken).catch(() => undefined);
                }
                setImportUrl(event.target.value);
                if (event.target.value.trim()) {
                  setImportArchivePath('');
                  setImportArchiveName('');
                }
                setImportPreview(null);
                setImportPreviewToken('');
                setImportErrorText('');
              }}
              placeholder={t.importUrlPlaceholder}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/45 focus:border-white/25"
              disabled={isPreviewingImport || isApplyingImport}
            />

            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => importArchiveInputRef.current?.click()}
                className="interactive-btn rounded-xl px-3 py-2 text-xs text-white/85"
                disabled={isPreviewingImport || isApplyingImport}
              >
                {uiText.importFileChoose}
              </button>
              <p className="truncate text-xs text-white/65">
                {importArchiveName || (language === 'ru' ? 'Архив не выбран' : 'Archive is not selected')}
              </p>
            </div>

            {importErrorText && (
              <p className="mt-2 break-words rounded-xl border border-rose-300/30 bg-rose-500/15 px-3 py-2 text-xs text-rose-100">
                {importErrorText}
              </p>
            )}

            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-xs font-medium text-white">{uiText.importPreviewSection}</p>
              {importPreview ? (
                <div className="mt-2 max-h-[200px] space-y-2 overflow-y-auto pr-1">
                  {importPreview.playlists.map((playlist) => (
                    <div key={playlist.name} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                      <p className="truncate text-xs font-medium text-white">
                        {playlist.name} ({playlist.fileCount})
                      </p>
                      <div className="mt-1 space-y-1">
                        {playlist.files.map((file, index) => (
                          <p key={`${file.name}_${index}`} className="truncate text-[11px] text-white/70">
                            {file.name}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-white/65">{uiText.importPreviewEmpty}</p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeImportModal().catch(() => undefined)}
                disabled={isPreviewingImport || isApplyingImport}
                className="interactive-btn rounded-xl px-3 py-2 text-xs text-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => requestImportPreview().catch(() => undefined)}
                disabled={isPreviewingImport || isApplyingImport}
                className="interactive-btn rounded-xl px-3 py-2 text-xs text-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPreviewingImport ? t.importPreviewLoading : t.importPreview}
              </button>
              <button
                type="button"
                onClick={() => applyImportFromPreview().catch(() => undefined)}
                disabled={isPreviewingImport || isApplyingImport}
                className="rounded-xl bg-white/20 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isApplyingImport ? t.importingNow : t.importApply}
              </button>
            </div>
          </div>
        </div>
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



