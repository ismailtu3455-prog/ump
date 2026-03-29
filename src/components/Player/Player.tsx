import { ButtonHTMLAttributes, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import {
  setCurrentFile,
  setCurrentTime,
  setDuration,
  setError,
  setIsFullscreen,
  setIsPlaying,
  setLoading,
  setPlaybackRate,
  setVolume,
  toggleMute,
  togglePlay,
} from '@store/playerSlice';
import {
  addFilesToPlaylist,
  nextTrack,
  previousTrack,
  setCurrentIndex,
  toggleRepeatMode,
  updateFileProgress,
} from '@store/playlistSlice';
import { addNotification } from '@store/uiSlice';
import { createMediaFileFromFile, formatDuration, safeFileName } from '@utils/fileUtils';
import { translations } from '@utils/translations';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}

type PlayerCommand =
  | 'toggle'
  | 'next'
  | 'previous'
  | 'toggle-repeat'
  | 'seek-backward'
  | 'seek-forward'
  | 'volume-down'
  | 'volume-up'
  | 'speed-down'
  | 'speed-up'
  | 'speed-reset'
  | 'toggle-mute'
  | 'toggle-fullscreen';

function IconButton({ label, active = false, className = '', children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`tooltip-trigger player-icon-btn ${active ? 'player-icon-btn--active' : ''} ${className}`}
      data-tooltip={label}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  );
}

function Player() {
  const dispatch = useAppDispatch();

  const player = useAppSelector((state) => state.player);
  const playlistState = useAppSelector((state) => state.playlist);
  const ui = useAppSelector((state) => state.ui);

  const { currentFile, isPlaying, currentTime, duration, volume, isMuted, playbackRate, isLoading, error } = player;
  const { playlists, activePlaylistId, currentIndex, repeatMode } = playlistState;
  const { delayEnabled, playbackDelaySec } = ui.playerSettings;
  const language = ui.language;
  const t = translations[language];

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const nextTrackTimeoutRef = useRef<number | null>(null);
  const nextTrackIntervalRef = useRef<number | null>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const previousPlaylistIdRef = useRef(activePlaylistId);

  const [showControls, setShowControls] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [seekMax, setSeekMax] = useState(0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const activePlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === activePlaylistId),
    [activePlaylistId, playlists]
  );
  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const repeatLabel = useMemo(() => {
    if (repeatMode === 'all') return t.repeatAll;
    if (repeatMode === 'one') return t.repeatOne;
    if (repeatMode === 'random') return t.repeatRandom;
    return t.repeatNone;
  }, [repeatMode, t.repeatAll, t.repeatNone, t.repeatOne, t.repeatRandom]);

  const clearNextTrackTimers = useCallback(() => {
    if (nextTrackTimeoutRef.current) {
      window.clearTimeout(nextTrackTimeoutRef.current);
      nextTrackTimeoutRef.current = null;
    }

    if (nextTrackIntervalRef.current) {
      window.clearInterval(nextTrackIntervalRef.current);
      nextTrackIntervalRef.current = null;
    }

    setNextCountdown(null);
  }, []);

  const executeCommand = useCallback(
    (command: PlayerCommand) => {
      const media = videoRef.current;

      switch (command) {
        case 'toggle': {
          if (!currentFile || currentFile.type === 'image') return;
          clearNextTrackTimers();
          dispatch(togglePlay());
          return;
        }
        case 'previous': {
          clearNextTrackTimers();
          dispatch(previousTrack());
          dispatch(setIsPlaying(true));
          return;
        }
        case 'next': {
          clearNextTrackTimers();
          dispatch(nextTrack());
          dispatch(setIsPlaying(true));
          return;
        }
        case 'toggle-repeat': {
          dispatch(toggleRepeatMode());
          return;
        }
        case 'seek-backward': {
          if (!media || !currentFile || currentFile.type === 'image') return;
          media.currentTime = Math.max(0, media.currentTime - 5);
          dispatch(setCurrentTime(media.currentTime));
          return;
        }
        case 'seek-forward': {
          if (!media || !currentFile || currentFile.type === 'image') return;
          const maxTime = seekMax || duration || Number.POSITIVE_INFINITY;
          media.currentTime = Math.min(maxTime, media.currentTime + 5);
          dispatch(setCurrentTime(media.currentTime));
          return;
        }
        case 'volume-down': {
          dispatch(setVolume(Math.max(0, volume - 5)));
          return;
        }
        case 'volume-up': {
          dispatch(setVolume(Math.min(100, volume + 5)));
          return;
        }
        case 'speed-down': {
          const nextRate = Math.max(0.5, Math.round((playbackRate - 0.25) * 100) / 100);
          dispatch(setPlaybackRate(nextRate));
          return;
        }
        case 'speed-up': {
          const nextRate = Math.min(2, Math.round((playbackRate + 0.25) * 100) / 100);
          dispatch(setPlaybackRate(nextRate));
          return;
        }
        case 'speed-reset': {
          dispatch(setPlaybackRate(1));
          return;
        }
        case 'toggle-mute': {
          dispatch(toggleMute());
          return;
        }
        case 'toggle-fullscreen': {
          if (!containerRef.current) return;

          if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(() => undefined);
          } else {
            document.exitFullscreen().catch(() => undefined);
          }
          return;
        }
        default:
          return;
      }
    },
    [
      clearNextTrackTimers,
      currentFile,
      dispatch,
      duration,
      playbackRate,
      seekMax,
      volume,
    ]
  );

  useEffect(() => {
    return () => {
      clearNextTrackTimers();
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [clearNextTrackTimers]);

  useEffect(() => {
    if (!isSeeking) return;

    const releaseSeek = () => setIsSeeking(false);
    window.addEventListener('mouseup', releaseSeek);
    window.addEventListener('touchend', releaseSeek);
    return () => {
      window.removeEventListener('mouseup', releaseSeek);
      window.removeEventListener('touchend', releaseSeek);
    };
  }, [isSeeking]);

  useEffect(() => {
    if (!showSpeedMenu) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!speedMenuRef.current) return;
      if (speedMenuRef.current.contains(event.target as Node)) return;
      setShowSpeedMenu(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSpeedMenu(false);
      }
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showSpeedMenu]);

  useEffect(() => {
    const handleCustomCommand = (event: Event) => {
      const detail = (event as CustomEvent<PlayerCommand>).detail;
      executeCommand(detail);
    };

    const handleIpcCommand = (payload: string) => {
      if (payload === 'toggle' || payload === 'next' || payload === 'previous') {
        executeCommand(payload);
      }
    };

    window.addEventListener('ump-player-command', handleCustomCommand as EventListener);
    window.electronAPI?.on('playback-control', handleIpcCommand);

    return () => {
      window.removeEventListener('ump-player-command', handleCustomCommand as EventListener);
      window.electronAPI?.off('playback-control', handleIpcCommand);
    };
  }, [executeCommand]);

  useEffect(() => {
    if (!activePlaylist || currentIndex < 0 || currentIndex >= activePlaylist.files.length) return;

    const file = activePlaylist.files[currentIndex];
    if (!currentFile || currentFile.id !== file.id) {
      dispatch(setCurrentFile(file));
      dispatch(setIsPlaying(file.type !== 'image'));
    }
  }, [activePlaylist, currentIndex, currentFile, dispatch]);

  useEffect(() => {
    const isPlaylistChanged = previousPlaylistIdRef.current !== activePlaylistId;
    previousPlaylistIdRef.current = activePlaylistId;

    if (isPlaylistChanged) return;
    if (!activePlaylist || !currentFile) return;
    if (currentIndex === -1 && activePlaylist.files.length > 0) return;

    const exists = activePlaylist.files.some((file) => file.id === currentFile.id);
    if (exists) return;

    if (activePlaylist.files.length === 0) {
      clearNextTrackTimers();
      dispatch(setCurrentFile(null));
      dispatch(setIsPlaying(false));
      dispatch(setCurrentTime(0));
      dispatch(setDuration(0));
      return;
    }

    const safeIndex = Math.max(0, Math.min(currentIndex, activePlaylist.files.length - 1));
    const fallbackFile = activePlaylist.files[safeIndex];
    dispatch(setCurrentIndex(safeIndex));
    dispatch(setCurrentFile(fallbackFile));
    dispatch(setIsPlaying(fallbackFile.type !== 'image'));
  }, [activePlaylist, activePlaylistId, clearNextTrackTimers, currentFile, currentIndex, dispatch]);

  useEffect(() => {
    const media = videoRef.current;

    if (!currentFile) {
      if (media) {
        media.pause();
        media.removeAttribute('src');
        media.load();
      }
      clearNextTrackTimers();
      dispatch(setError(null));
      setSeekMax(0);
      return;
    }

    if (currentFile.type === 'image') {
      if (media) {
        media.pause();
      }
      clearNextTrackTimers();
      dispatch(setLoading(false));
      dispatch(setIsPlaying(false));
      setSeekMax(0);
      return;
    }

    if (!media) return;

    clearNextTrackTimers();
    dispatch(setLoading(true));
    dispatch(setError(null));

    media.pause();
    media.src = currentFile.path;
    media.load();
    setSeekMax(0);
  }, [clearNextTrackTimers, currentFile, dispatch]);

  useEffect(() => {
    const media = videoRef.current;
    if (!media || !currentFile || currentFile.type === 'image') return;

    media.volume = volume / 100;
    media.muted = isMuted;
  }, [currentFile, isMuted, volume]);

  useEffect(() => {
    const media = videoRef.current;
    if (!media || !currentFile || currentFile.type === 'image') return;

    media.playbackRate = playbackRate;
  }, [currentFile, playbackRate]);

  useEffect(() => {
    const media = videoRef.current;
    if (!media || !currentFile || currentFile.type === 'image') return;

    if (isPlaying) {
      media.play().catch(() => undefined);
    } else {
      media.pause();
    }
  }, [currentFile, isPlaying]);

  useEffect(() => {
    const onFullscreenChange = () => {
      dispatch(setIsFullscreen(Boolean(document.fullscreenElement)));
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [dispatch]);

  const queueNextTrack = useCallback(() => {
    if (!activePlaylist || activePlaylist.files.length === 0) return;

    const atLast = currentIndex >= activePlaylist.files.length - 1;
    if (repeatMode === 'none' && atLast) {
      dispatch(setIsPlaying(false));
      return;
    }

    const delayMs = delayEnabled ? Math.max(0, playbackDelaySec * 1000) : 0;
    if (delayMs === 0) {
      dispatch(nextTrack());
      dispatch(setIsPlaying(true));
      return;
    }

    let seconds = Math.ceil(delayMs / 1000);
    setNextCountdown(seconds);

    nextTrackIntervalRef.current = window.setInterval(() => {
      seconds -= 1;
      setNextCountdown(Math.max(seconds, 0));
    }, 1000);

    nextTrackTimeoutRef.current = window.setTimeout(() => {
      clearNextTrackTimers();
      dispatch(nextTrack());
      dispatch(setIsPlaying(true));
    }, delayMs);
  }, [
    activePlaylist,
    clearNextTrackTimers,
    currentIndex,
    delayEnabled,
    dispatch,
    playbackDelaySec,
    repeatMode,
  ]);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || isSeeking) return;

    const media = videoRef.current;
    const time = Number.isFinite(media.currentTime) ? media.currentTime : 0;
    const fallbackDuration =
      media.seekable && media.seekable.length > 0
        ? media.seekable.end(media.seekable.length - 1)
        : 0;
    const mediaDuration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : fallbackDuration;
    setSeekMax(mediaDuration);

    dispatch(setCurrentTime(time));
    dispatch(setDuration(mediaDuration));

    if (currentFile && activePlaylistId) {
      const progress = mediaDuration > 0 ? (time / mediaDuration) * 100 : 0;
      dispatch(
        updateFileProgress({
          playlistId: activePlaylistId,
          fileId: currentFile.id,
          progress,
        })
      );
    }
  }, [activePlaylistId, currentFile, dispatch, isSeeking]);

  const handleEnded = useCallback(() => {
    if (!videoRef.current) return;

    if (repeatMode === 'one') {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => undefined);
      return;
    }

    dispatch(setIsPlaying(false));
    queueNextTrack();
  }, [dispatch, queueNextTrack, repeatMode]);

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const media = videoRef.current;
    if (!media) return;

    const limit = seekMax || duration || 0;
    const targetTime = Math.max(0, Math.min(limit, Number(event.target.value)));
    media.currentTime = targetTime;
    dispatch(setCurrentTime(targetTime));
  };

  const toggleByMediaClick = () => {
    if (!currentFile || currentFile.type === 'image') return;
    executeCommand('toggle');
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    dispatch(setVolume(value));
  };

  const handleSpeedChange = (speed: number) => {
    dispatch(setPlaybackRate(speed));
    setShowSpeedMenu(false);
  };

  const handleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(() => undefined);
      return;
    }

    await document.exitFullscreen().catch(() => undefined);
  };

  const handlePictureInPicture = async () => {
    const media = videoRef.current;
    if (!media || currentFile?.type !== 'video') return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await media.requestPictureInPicture();
      } else {
        await window.electronAPI?.enterPictureInPicture();
      }
    } catch {
      await window.electronAPI?.enterPictureInPicture();
    }
  };

  const handleFrameScreenshot = () => {
    if (!videoRef.current || currentFile?.type !== 'video') return;

    const media = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = media.videoWidth;
    canvas.height = media.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(media, 0, 0, canvas.width, canvas.height);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${safeFileName(currentFile.name)}-${Math.floor(media.currentTime)}s.png`;
    link.click();

    dispatch(
      addNotification({
        type: 'success',
        title: t.screenshotSaved,
        message: currentFile.name,
      })
    );
  };

  const addDroppedFiles = useCallback(
    (files: File[]) => {
      const mediaFiles = files
        .map((file) => createMediaFileFromFile(file))
        .filter((file): file is NonNullable<typeof file> => Boolean(file));

      if (mediaFiles.length === 0) return;

      const startIndex = activePlaylist?.files.length ?? 0;
      dispatch(addFilesToPlaylist({ playlistId: activePlaylistId, files: mediaFiles }));

      if (!currentFile) {
        dispatch(setCurrentIndex(startIndex));
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
    },
    [activePlaylist?.files.length, activePlaylistId, currentFile, dispatch, t.fileAdded, t.filesCount]
  );

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      addDroppedFiles(files);
    }
  };

  const onMouseMove = () => {
    setShowControls(true);
    if (!isPlaying) return;

    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }

    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 2400);
  };

  const mediaVisual = (() => {
    if (!currentFile) {
      return (
        <div className="flex flex-col items-center gap-3 text-center text-white/75">
          <div className="hero-glow flex h-24 w-24 items-center justify-center rounded-full">
            <span className="text-lg font-semibold">UM</span>
          </div>
          <p className="text-xl font-semibold">{t.noMediaTitle}</p>
          <p className="text-sm text-white/55">{t.noMediaHint}</p>
        </div>
      );
    }

    if (currentFile.type === 'image') {
      return (
        <img
          src={currentFile.path}
          alt={currentFile.name}
          className="max-h-full max-w-full rounded-2xl object-contain shadow-soft"
          style={{ transform: `scale(${imageScale})` }}
        />
      );
    }

    if (currentFile.type === 'audio') {
      return (
        <div className="audio-cover flex flex-col items-center justify-center rounded-3xl border border-white/15 bg-white/5 px-8 py-10 text-center">
          <div className="mb-5 flex gap-1">
            {[0, 1, 2, 3, 4].map((bar) => (
              <span
                key={bar}
                className={`audio-bar h-8 w-1.5 rounded-full bg-white/70 ${isPlaying ? 'is-playing' : ''}`}
              />
            ))}
          </div>
          <p className="max-w-[500px] truncate text-xl font-semibold text-white">{currentFile.name}</p>
          <p className="mt-1 text-sm uppercase tracking-wide text-white/45">{currentFile.format}</p>
        </div>
      );
    }

    return null;
  })();

  const repeatIcon = repeatMode === 'one' ? '1' : repeatMode === 'random' ? 'S' : undefined;

  return (
    <div
      ref={containerRef}
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45 ${
        isDragOver ? 'ring-2 ring-white/50' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onMouseMove={onMouseMove}
    >
      <video
        ref={videoRef}
        className={`h-full w-full object-contain ${currentFile?.type === 'video' ? 'block' : 'hidden'}`}
        preload="auto"
        onClick={toggleByMediaClick}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={() => {
          dispatch(setLoading(false));
          if (videoRef.current) {
            const durationValue =
              Number.isFinite(videoRef.current.duration) && videoRef.current.duration > 0
                ? videoRef.current.duration
                : videoRef.current.seekable.length > 0
                  ? videoRef.current.seekable.end(videoRef.current.seekable.length - 1)
                  : 0;
            dispatch(setDuration(durationValue));
            setSeekMax(durationValue);
          }
        }}
        onDurationChange={() => {
          if (!videoRef.current) return;
          const durationValue =
            Number.isFinite(videoRef.current.duration) && videoRef.current.duration > 0
              ? videoRef.current.duration
              : videoRef.current.seekable.length > 0
                ? videoRef.current.seekable.end(videoRef.current.seekable.length - 1)
                : 0;
          if (durationValue > 0) {
            dispatch(setDuration(durationValue));
            setSeekMax(durationValue);
          }
        }}
        onCanPlay={() => {
          dispatch(setLoading(false));
          if (isPlaying) {
            videoRef.current?.play().catch(() => undefined);
          }
        }}
        onError={() => {
          dispatch(setLoading(false));
          dispatch(setError(`${t.error}: ${currentFile?.name || ''}`));
        }}
      />

      <div
        className={`absolute inset-0 flex items-center justify-center p-8 ${
          currentFile?.type === 'video' ? 'pointer-events-none' : ''
        }`}
        onClick={toggleByMediaClick}
      >
        {mediaVisual}
      </div>

      {currentFile?.type === 'image' && (
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-white/20 bg-slate-900/70 px-2 py-1 text-xs text-white backdrop-blur">
          <button type="button" className="px-1.5" onClick={() => setImageScale((v) => Math.max(0.5, v - 0.1))}>
            -
          </button>
          <span>{Math.round(imageScale * 100)}%</span>
          <button type="button" className="px-1.5" onClick={() => setImageScale((v) => Math.min(3, v + 0.1))}>
            +
          </button>
          <button type="button" className="px-1.5" onClick={() => setImageScale(1)}>
            1:1
          </button>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/65">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}

      {isDragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/75">
          <p className="rounded-2xl border border-white/20 bg-white/5 px-6 py-4 text-sm text-white backdrop-blur">
            {t.dropHint}
          </p>
        </div>
      )}

      {error && (
        <div className="absolute left-4 top-4 z-30 rounded-xl border border-rose-300/30 bg-rose-500/20 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      )}

      {nextCountdown !== null && (
        <div className="absolute left-1/2 top-6 z-30 -translate-x-1/2 rounded-xl border border-white/20 bg-slate-900/75 px-4 py-2 text-sm text-white backdrop-blur">
          {t.next}: {nextCountdown}s
        </div>
      )}

      {showControls && (
        <div className="controls-enter absolute bottom-0 left-0 right-0 z-40 p-4">
          <div className="rounded-2xl border border-white/15 bg-slate-900/65 p-3 shadow-soft backdrop-blur-xl">
            <div className="mb-3">
              <input
                type="range"
                min={0}
                max={seekMax || duration || 0}
                step={0.1}
                value={Math.min(currentTime, seekMax || duration || 0)}
                onChange={handleSeek}
                onInput={handleSeek}
                onMouseDown={() => setIsSeeking(true)}
                onMouseUp={() => setIsSeeking(false)}
                onTouchStart={() => setIsSeeking(true)}
                onTouchEnd={() => setIsSeeking(false)}
                className="player-range w-full"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <IconButton onClick={() => executeCommand('toggle')} label={isPlaying ? t.pause : t.play} className="h-11 w-11">
                  {isPlaying ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <path d="m8 5 11 7-11 7V5Z" />
                    </svg>
                  )}
                </IconButton>

                <IconButton onClick={() => executeCommand('previous')} label={t.previous}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M6 6h2v12H6V6Zm4 6 8-6v12l-8-6Z" />
                  </svg>
                </IconButton>

                <IconButton
                  onClick={() => executeCommand('toggle-repeat')}
                  label={`${t.repeat}: ${repeatLabel}`}
                  active={repeatMode !== 'none'}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path
                      d="M17 2l3 3-3 3M4 11V8a3 3 0 0 1 3-3h13M7 22l-3-3 3-3M20 13v3a3 3 0 0 1-3 3H4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {repeatIcon && (
                    <span className="pointer-events-none absolute -right-1.5 -top-1.5 rounded-full bg-white/25 px-1 text-[9px] font-semibold">
                      {repeatIcon}
                    </span>
                  )}
                </IconButton>

                <IconButton onClick={() => executeCommand('next')} label={t.next}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M16 6h2v12h-2V6Zm-2 6-8-6v12l8-6Z" />
                  </svg>
                </IconButton>
              </div>

              <div className="flex min-w-[180px] flex-1 items-center justify-center gap-2 text-xs text-white/70">
                <span>{repeatLabel}</span>
                <span className="text-white/60">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <div
                  ref={speedMenuRef}
                  className="player-speed-panel relative flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-2 py-1.5"
                >
                  <span className="text-xs text-white/75">{t.speed}</span>
                  <button
                    type="button"
                    onClick={() => setShowSpeedMenu((value) => !value)}
                    className="player-speed-trigger rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs text-white transition hover:bg-white/20"
                  >
                    {playbackRate}x
                  </button>
                  {showSpeedMenu && (
                    <div className="speed-menu absolute bottom-[calc(100%+8px)] right-0 z-50 min-w-[104px] rounded-xl border border-white/15 bg-slate-900/95 p-1.5 shadow-soft backdrop-blur">
                      {speedOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleSpeedChange(option)}
                          className={`speed-menu-item w-full rounded-lg px-2 py-1.5 text-left text-xs transition ${
                            playbackRate === option
                              ? 'bg-white/25 text-white'
                              : 'text-white/85 hover:bg-white/10'
                          }`}
                        >
                          {option}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <IconButton onClick={() => dispatch(toggleMute())} label={t.volume}>
                  {isMuted || volume === 0 ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
                      <path d="M17 9.5 21 14M21 9.5 17 14" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
                      <path d="M15.5 9.5a4 4 0 0 1 0 5M18 7a7 7 0 0 1 0 10" strokeLinecap="round" />
                    </svg>
                  )}
                </IconButton>

                <input
                  type="range"
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="player-range w-20"
                />

                <IconButton onClick={handleFullscreen} label={t.fullscreen}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" strokeLinecap="round" />
                  </svg>
                </IconButton>

                <IconButton
                  onClick={handlePictureInPicture}
                  disabled={currentFile?.type !== 'video'}
                  label={t.pip}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <rect x="12" y="11" width="7" height="6" rx="1.2" fill="currentColor" stroke="none" />
                  </svg>
                </IconButton>

                <IconButton
                  onClick={handleFrameScreenshot}
                  disabled={currentFile?.type !== 'video'}
                  label={t.screenshot}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 8h4l1.5-2h5L16 8h4v10H4V8Z" strokeLinejoin="round" />
                    <circle cx="12" cy="13" r="3.2" />
                  </svg>
                </IconButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Player;
