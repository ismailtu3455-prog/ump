import { useRef, useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import {
  togglePlay,
  setCurrentTime,
  setDuration,
  setVolume,
  toggleMute,
  setPlaybackRate,
  toggleFullscreen,
  setCurrentFile,
  setIsPlaying,
  setLoading,
  setError,
} from '@store/playerSlice';
import { nextTrack, previousTrack, addFilesToPlaylist, updateFileProgress } from '@store/playlistSlice';
import { updateHistoryProgress } from '@store/historySlice';
import { formatDuration, detectMediaType, getFileExtension, generateId } from '@/utils/fileUtils';

function Player() {
  const dispatch = useAppDispatch();
  const { currentFile, isPlaying, currentTime, duration, volume, isMuted, playbackRate, isLoading, error } = useAppSelector(state => state.player);
  const { activePlaylistId, currentIndex, playlists } = useAppSelector(state => state.playlist);

  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [zoom, setZoom] = useState(100);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  const handleFilesAdded = useCallback((files: File[]) => {
    const mediaFiles = files.map(file => ({
      id: generateId(),
      name: file.name,
      path: URL.createObjectURL(file),
      type: detectMediaType(file.name) || 'video',
      format: getFileExtension(file.name),
      size: file.size,
      addedAt: Date.now(),
    }));

    dispatch(addFilesToPlaylist({ playlistId: 'recent', files: mediaFiles }));
    
    if (!currentFile && mediaFiles.length > 0) {
      dispatch(setCurrentFile(mediaFiles[0]));
      dispatch(setIsPlaying(true));
    }
  }, [dispatch, currentFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(
      file => detectMediaType(file.name) !== null
    );
    
    if (files.length > 0) {
      handleFilesAdded(files);
    }
  }, [handleFilesAdded]);

  useEffect(() => {
    if (currentFile?.path && videoRef.current && currentFile.type !== 'image') {
      const video = videoRef.current;
      const wasPlaying = isPlaying;

      dispatch(setLoading(true));
      dispatch(setError(null));

      video.src = currentFile.path;
      video.load();

      video.onloadeddata = () => {
        dispatch(setLoading(false));
        // Генерируем миниатюру
        generateThumbnail(video);

        // Восстанавливаем воспроизведение если оно было активно
        if (wasPlaying) {
          video.play().catch(err => console.error('Play error:', err));
        }
      };

      video.onerror = () => {
        dispatch(setLoading(false));
        dispatch(setError(`Не удалось загрузить файл: ${currentFile.name}`));
      };
    }
  }, [currentFile?.path, currentFile?.type, dispatch]);

  // Генерация миниатюры
  const generateThumbnail = (video: HTMLVideoElement) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      if (ctx && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setThumbnail(canvas.toDataURL('image/jpeg', 0.7));
      }
    } catch (err) {
      console.error('Thumbnail generation error:', err);
    }
  };

  // Обновление прогресса просмотра
  useEffect(() => {
    if (videoRef.current && currentFile && activePlaylistId) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;

      // Обновляем в playlist
      dispatch(updateFileProgress({
        playlistId: activePlaylistId,
        fileId: currentFile.id,
        progress: Math.min(100, progress),
      }));

      // Обновляем в истории
      dispatch(updateHistoryProgress({
        fileId: currentFile.id,
        progress: Math.min(100, progress),
      }));
    }
  }, [currentTime, currentFile, activePlaylistId, dispatch]);

  // Следим за изменением currentIndex для переключения треков
  useEffect(() => {
    if (activePlaylistId && currentIndex >= 0) {
      const playlist = playlists.find(p => p.id === activePlaylistId);
      if (playlist && playlist.files[currentIndex]) {
        const file = playlist.files[currentIndex];
        // Переключаем файл только если это не текущий файл
        if (!currentFile || currentFile.id !== file.id) {
          dispatch(setCurrentFile(file));
          dispatch(setIsPlaying(true));
        }
      }
    }
  }, [currentIndex, activePlaylistId, playlists, dispatch, currentFile?.id]);

  useEffect(() => {
    if (currentFile?.path && imgRef.current && currentFile.type === 'image') {
      console.log('Loading image:', currentFile.path);
      imgRef.current.src = currentFile.path;
    }
  }, [currentFile?.path, currentFile?.type]);

  useEffect(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.play().catch(console.error);
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      dispatch(setCurrentTime(videoRef.current.currentTime));
      dispatch(setDuration(videoRef.current.duration));
    }
  }, [dispatch]);

  const handleEnded = useCallback(() => {
    dispatch(nextTrack());
  }, [dispatch]);

  const togglePlayPause = useCallback(() => {
    dispatch(togglePlay());
  }, [dispatch]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      dispatch(setCurrentTime(time));
      // Если видео было на паузе, запускаем его снова
      if (videoRef.current.paused) {
        videoRef.current.play().catch(console.error);
      }
    }
  }, [dispatch]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = vol / 100;
      dispatch(setVolume(vol));
    }
  }, [dispatch]);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      dispatch(setPlaybackRate(rate));
    }
  }, [dispatch]);

  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
    dispatch(toggleFullscreen());
  }, [dispatch]);

  const handlePictureInPicture = useCallback(async () => {
    try {
      if (!videoRef.current) return;
      
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      console.error('PiP error:', error);
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 25, 300));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 25, 50));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(100);
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowRight':
          if (videoRef.current) videoRef.current.currentTime += 5;
          break;
        case 'ArrowLeft':
          if (videoRef.current) videoRef.current.currentTime -= 5;
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1);
            dispatch(setVolume(videoRef.current.volume * 100));
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
            dispatch(setVolume(videoRef.current.volume * 100));
          }
          break;
        case 'KeyF':
          handleFullscreen();
          break;
        case 'KeyN':
          dispatch(nextTrack());
          break;
        case 'KeyP':
          dispatch(previousTrack());
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, togglePlayPause, handleFullscreen]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center bg-black transition-colors ${
        isDragOver ? 'bg-primary-900/20 ring-4 ring-primary-500' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className={`max-w-full max-h-full ${currentFile?.type === 'image' ? 'hidden' : ''}`}
        onClick={togglePlayPause}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />

      {/* Индикатор загрузки */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-40">
          <div className="flex flex-col items-center gap-4">
            <svg className="animate-spin h-12 w-12 text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-white text-sm">Загрузка...</p>
          </div>
        </div>
      )}

      {/* Сообщение об ошибке */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-40">
          <div className="bg-dark-800 rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-white">Ошибка воспроизведения</h3>
            </div>
            <p className="text-dark-300 mb-4">{error}</p>
            <div className="flex gap-2">
              <button
                onClick={() => dispatch(setError(null))}
                className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
              >
                Закрыть
              </button>
              <button
                onClick={() => dispatch(nextTrack())}
                className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors"
              >
                Следующий
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Миниатюра в углу при воспроизведении */}
      {thumbnail && !isLoading && !error && showControls && currentFile?.type === 'video' && (
        <div className="absolute top-4 right-4 w-32 h-18 bg-dark-800 rounded-lg overflow-hidden shadow-lg border border-dark-600">
          <img src={thumbnail} alt="Preview" className="w-full h-full object-cover" />
        </div>
      )}
      
      {/* Image element */}
      <img
        ref={imgRef}
        className={`max-w-full max-h-full transition-transform duration-200 ${currentFile?.type !== 'image' ? 'hidden' : ''}`}
        style={{ transform: `scale(${zoom / 100})` }}
        alt={currentFile?.name || ''}
      />

      {isDragOver && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
          <svg className="w-32 h-32 text-primary-500 mb-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-2xl font-semibold text-white">Отпустите файлы для воспроизведения</p>
          <p className="text-dark-400 mt-2">Видео, аудио, изображения</p>
        </div>
      )}

      {!currentFile && !isDragOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-dark-400 p-8">
          <div className="w-32 h-32 mb-6 rounded-full bg-dark-800 flex items-center justify-center">
            <svg className="w-16 h-16 opacity-50" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
            </svg>
          </div>
          <p className="text-xl font-medium text-white mb-2">Перетащите файлы сюда</p>
          <p className="text-sm opacity-70 text-center">
            Поддерживаются: MP4, WebM, MKV, AVI<br/>MP3, WAV, FLAC • JPG, PNG, WEBP
          </p>
        </div>
      )}

      {showControls && currentFile?.type === 'video' && (
        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          {/* Progress bar */}
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 mb-4 accent-primary-500 cursor-pointer"
            style={{
              background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${(currentTime / (duration || 1)) * 100}%, #475569 ${(currentTime / (duration || 1)) * 100}%, #475569 100%)`
            }}
          />

          <div className="flex items-center justify-between w-full">
            {/* Левая часть - Play/Pause, Previous/Next, Time */}
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button onClick={togglePlayPause} className="p-3 bg-primary-600 hover:bg-primary-500 rounded-full transition-colors">
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Previous/Next */}
              <button onClick={() => dispatch(previousTrack())} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>
              <button onClick={() => dispatch(nextTrack())} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>

              {/* Time */}
              <span className="text-sm text-white/80 min-w-[100px]">
                {formatDuration(currentTime)} / {formatDuration(duration)}
              </span>

              {/* Zoom controls for images */}
              {(currentFile?.type as string) === 'image' && (
                <div className="flex items-center gap-1 border-l border-white/20 pl-3 ml-2">
                  <button onClick={handleZoomOut} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Уменьшить">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="text-sm text-white/80 w-12 text-center">{zoom}%</span>
                  <button onClick={handleZoomIn} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Увеличить">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button onClick={handleZoomReset} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Сбросить">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Правая часть - Volume, Speed, PiP, Fullscreen (справа налево) */}
            <div className="flex items-center gap-3 flex-row-reverse">
              {/* Fullscreen */}
              <button onClick={handleFullscreen} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Полноэкранный режим (F)">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              </button>

              {/* Picture-in-Picture */}
              <button onClick={handlePictureInPicture} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="PiP режим">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>

              {/* Playback speed */}
              <select
                value={playbackRate}
                onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
                className="bg-dark-700 hover:bg-dark-600 border border-dark-500 rounded px-2 py-1.5 text-sm text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
                title="Скорость"
              >
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
              </select>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <button onClick={() => dispatch(toggleMute())} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  {isMuted || volume === 0 ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : volume < 33 ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                    </svg>
                  ) : volume < 66 ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM19.5 12c0-2.07-1.02-3.91-2.59-5.07l-1.41 1.41c.95.95 1.5 2.25 1.5 3.66s-.55 2.71-1.5 3.66l1.41 1.41c1.57-1.16 2.59-3 2.59-5.07z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 accent-primary-500 cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${isMuted ? 0 : volume}%, #475569 ${isMuted ? 0 : volume}%, #475569 100%)`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Player;
