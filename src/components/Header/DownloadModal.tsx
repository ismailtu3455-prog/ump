import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import { addFilesToPlaylist } from '@store/playlistSlice';
import { generateId } from '@/utils/fileUtils';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormatOption {
  id: string;
  quality: string;
  format: string;
  size: string;
}

interface VideoInfo {
  title: string;
  duration: string;
  thumbnail: string;
  formats: FormatOption[];
}

function DownloadModal({ isOpen, onClose }: DownloadModalProps) {
  const dispatch = useAppDispatch();
  const playlists = useAppSelector(state => state.playlist.playlists);
  const activePlaylistId = useAppSelector(state => state.playlist.activePlaylistId);
  const [step, setStep] = useState<'url' | 'options' | 'downloading' | 'complete'>('url');
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<FormatOption | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState('');

  // Логирование при открытии
  useEffect(() => {
    if (isOpen) {
      console.log('DownloadModal opened. Active playlist:', activePlaylistId);
      console.log('All playlists:', playlists.map(p => ({ id: p.id, name: p.name })));
    }
  }, [isOpen, activePlaylistId, playlists]);

  // Получение информации о видео
  const fetchVideoInfo = async () => {
    if (!url.trim()) {
      setError('Введите URL видео');
      return;
    }

    console.log('Fetching video info for:', url);
    setError('');
    setStep('downloading');
    setDownloadProgress(0);
    
    try {
      // Тест связи
      console.log('Testing connection...');
      const testResult = await window.electronAPI?.invoke('test-connection');
      console.log('Test result:', testResult);
      
      // Таймаут на 15 секунд
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Превышено время ожидания')), 15000)
      );
      
      console.log('Calling youtube-get-info...');
      const result = await Promise.race([
        window.electronAPI?.youtubeGetInfo(url),
        timeoutPromise
      ]);
      
      console.log('Result received:', result);
      
      if (result?.success && result.videoInfo) {
        setVideoInfo(result.videoInfo);
        setStep('options');
        setSelectedFormat(null);
      } else if (result?.error) {
        setError(result.error);
        setStep('url');
      } else {
        setError('Не удалось получить информацию о видео. Проверьте ссылку.');
        setStep('url');
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Ошибка подключения к YouTube. Проверьте интернет.');
      setStep('url');
    }
  };

  // Начало скачивания
  const startDownload = async () => {
    if (!selectedFormat || !videoInfo) {
      setError('Выберите формат');
      return;
    }

    // Получаем актуальный activePlaylistId на момент скачивания
    const currentActivePlaylistId = activePlaylistId;
    console.log('Starting download to playlist:', currentActivePlaylistId);

    setStep('downloading');
    setDownloadProgress(0);
    setError('');

    try {
      // Таймаут на 5 минут для скачивания
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Превышено время скачивания')), 300000)
      );

      const result = await Promise.race([
        window.electronAPI?.youtubeDownload(url, selectedFormat.id, videoInfo.title),
        timeoutPromise
      ]);

      if (result?.success) {
        // Добавляем файл в активный плейлист
        const newFile = {
          id: generateId(),
          name: videoInfo.title,
          path: result.path,
          type: 'video' as const,
          format: selectedFormat.format,
          size: 0,
          addedAt: Date.now(),
          isSaved: true,
          quality: selectedFormat.quality,
        };

        console.log('Adding downloaded video to playlist:', currentActivePlaylistId);
        console.log('File data:', newFile);
        
        dispatch(addFilesToPlaylist({
          playlistId: currentActivePlaylistId,
          files: [newFile]
        }));

        setStep('complete');
        setDownloadProgress(100);
      } else {
        setError(result?.error || 'Ошибка при скачивании');
        setStep('options');
      }
    } catch (err: any) {
      console.error('Download error:', err);
      setError(err.message || 'Ошибка при скачивании');
      setStep('options');
    }
  };

  const handleFinish = () => {
    setStep('url');
    setUrl('');
    setVideoInfo(null);
    setSelectedFormat(null);
    setDownloadProgress(0);
    setError('');
    onClose();
  };

  // Слушаем события прогресса скачивания
  useEffect(() => {
    if (!isOpen) return;

    const handleProgress = (_: any, progress: number) => {
      setDownloadProgress(progress);
    };

    const handleComplete = (_: any, filePath: string) => {
      console.log('Download complete:', filePath);
    };

    window.electronAPI?.on('download-progress', handleProgress);
    window.electronAPI?.on('download-complete', handleComplete);

    return () => {
      window.electronAPI?.removeAllListeners('download-progress');
      window.electronAPI?.removeAllListeners('download-complete');
    };
  }, [isOpen]);

  // Сброс состояния при закрытии
  useEffect(() => {
    if (!isOpen) {
      setStep('url');
      setUrl('');
      setVideoInfo(null);
      setSelectedFormat(null);
      setDownloadProgress(0);
      setError('');
    }
  }, [isOpen]);

  // Форматирование длительности
  const formatDuration = (seconds: string) => {
    const secs = parseInt(seconds);
    const mins = Math.floor(secs / 60);
    const secsRemainder = secs % 60;
    return `${mins}:${secsRemainder.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-lg p-6 w-[420px] max-w-md">
        {/* Шаг 1: Ввод URL */}
        {step === 'url' && (
          <>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Скачать видео
            </h3>

            <p className="text-sm text-dark-400 mb-4">
              Поддерживаются: YouTube, TikTok, Vimeo, Twitter и другие
            </p>

            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-white placeholder-dark-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && fetchVideoInfo()}
            />

            {error && step === 'url' && (
              <p className="text-red-400 text-sm mb-3">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={fetchVideoInfo}
                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium text-white"
              >
                Далее
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors font-medium text-white"
              >
                Отмена
              </button>
            </div>
          </>
        )}

        {/* Шаг 2: Выбор формата */}
        {step === 'options' && videoInfo && (
          <>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Выберите формат
            </h3>

            <div className="mb-4 p-3 bg-dark-700 rounded-lg">
              <p className="text-sm font-medium text-white truncate">{videoInfo.title}</p>
              <p className="text-xs text-dark-400 mt-1">Длительность: {formatDuration(videoInfo.duration)}</p>
            </div>

            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {videoInfo.formats.map((format) => (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format)}
                  className={`w-full p-3 rounded-lg border transition-colors flex items-center justify-between ${
                    selectedFormat?.id === format.id
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-dark-600 bg-dark-700 hover:bg-dark-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedFormat?.id === format.id ? 'border-primary-500' : 'border-dark-500'
                    }`}>
                      {selectedFormat?.id === format.id && (
                        <div className="w-2 h-2 rounded-full bg-primary-500" />
                      )}
                    </div>
                    <span className="text-sm text-white">{format.quality}</span>
                  </div>
                  <div className="text-xs text-dark-400">
                    {format.format.toUpperCase()} • {format.size}
                  </div>
                </button>
              ))}
            </div>

            {error && step === 'options' && (
              <p className="text-red-400 text-sm mb-3">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={startDownload}
                disabled={!selectedFormat}
                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-dark-600 disabled:cursor-not-allowed rounded-lg transition-colors font-medium text-white"
              >
                Скачать
              </button>
              <button
                onClick={() => setStep('url')}
                className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors font-medium text-white"
              >
                Назад
              </button>
            </div>
          </>
        )}

        {/* Шаг 3: Прогресс скачивания */}
        {step === 'downloading' && (
          <>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <svg className="w-6 h-6 text-primary-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {videoInfo ? 'Скачивание...' : 'Получение информации...'}
            </h3>

            {videoInfo && (
              <div className="mb-4 p-3 bg-dark-700 rounded-lg">
                <p className="text-sm font-medium text-white truncate">{videoInfo.title}</p>
              </div>
            )}

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-dark-400">
                  {videoInfo ? 'Загрузка файла...' : 'Подготовка...'}
                </span>
                <span className="text-white">{Math.min(100, Math.round(downloadProgress))}%</span>
              </div>
              <div className="h-4 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, downloadProgress)}%` }}
                />
              </div>
            </div>

            {/* Анимация загрузки */}
            <div className="flex justify-center mb-4">
              <svg className="animate-spin h-8 w-8 text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>

            <p className="text-sm text-dark-400 text-center mb-4">
              {videoInfo 
                ? 'Идёт скачивание видео. Пожалуйста, подождите...' 
                : 'Получаем информацию о видео с YouTube...'}
            </p>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('url');
                  setError('');
                  setDownloadProgress(0);
                }}
                className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors text-sm text-white"
              >
                {error ? 'Попробовать снова' : 'Отмена'}
              </button>
            </div>
          </>
        )}

        {/* Шаг 4: Завершено */}
        {step === 'complete' && (
          <>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Готово!
            </h3>

            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-white">
                Видео успешно скачано и добавлено в плейлист "Недавние"
              </p>
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium text-white"
            >
              Закрыть
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default DownloadModal;
