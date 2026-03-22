import { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import { addFilesToPlaylist } from '@store/playlistSlice';
import { setCurrentFile, setIsPlaying, togglePlay } from '@store/playerSlice';
import { generateId } from '@/utils/fileUtils';

interface MusicOnlineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  videoId: string;
  thumbnail: string;
  duration: string;
  url: string;
  type?: string;
}

function MusicOnlineModal({ isOpen, onClose }: MusicOnlineModalProps) {
  const dispatch = useAppDispatch();
  const activePlaylistId = useAppSelector(state => state.playlist.activePlaylistId);
  const isPlaying = useAppSelector(state => state.player.isPlaying);
  
  const [step, setStep] = useState<'search' | 'results' | 'playing'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPlayingLocal, setIsPlayingLocal] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Получение подсказок при вводе
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        fetchSuggestions();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchSuggestions = async () => {
    try {
      const result = await window.electronAPI?.ytMusicSuggestions(searchQuery);
      if (result?.success && result.suggestions) {
        setSuggestions(result.suggestions);
      }
    } catch (err) {
      console.error('Suggestions error:', err);
    }
  };

  // Фокус на поле поиска при открытии
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Поиск музыки через YouTube Music API
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Введите поисковый запрос');
      return;
    }

    setIsLoading(true);
    setError('');
    setStep('results');

    try {
      const result = await window.electronAPI?.ytMusicSearch(searchQuery, 20, 'songs');
      
      if (result?.success && result.tracks) {
        const tracks: Track[] = result.tracks.map((track: any) => ({
          id: track.id || track.videoId,
          title: track.title,
          artist: track.artist,
          album: track.album,
          videoId: track.videoId,
          thumbnail: track.thumbnail,
          duration: track.duration,
          url: `https://music.youtube.com/watch?v=${track.videoId}`,
          type: track.type,
        }));
        setSearchResults(tracks);
      } else {
        setError(result?.error || 'Ничего не найдено');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Ошибка поиска. Убедитесь, что Python сервер запущен.');
    } finally {
      setIsLoading(false);
    }
  };

  // Воспроизведение трека
  const playTrack = async (track: Track) => {
    setIsLoading(true);
    setError('');
    
    try {
      // Получаем информацию о видео
      const result = await window.electronAPI?.youtubeGetInfo?.(track.url);
      
      if (result?.success) {
        // Создаём медиафайл для плеера
        const mediaFile = {
          id: generateId(),
          name: track.title,
          path: track.url,
          type: 'audio' as const,
          format: 'youtube',
          size: 0,
          addedAt: Date.now(),
          isLink: true,
          thumbnail: track.thumbnail,
        };

        // Добавляем в плейлист
        dispatch(addFilesToPlaylist({
          playlistId: activePlaylistId || 'recent',
          files: [mediaFile],
        }));

        // Устанавливаем как текущий файл
        dispatch(setCurrentFile(mediaFile));
        dispatch(setIsPlaying(true));
        
        setCurrentTrack(track);
        setStep('playing');
        setIsPlayingLocal(true);
      } else {
        setError('Не удалось загрузить трек');
      }
    } catch (err: any) {
      console.error('Play error:', err);
      setError(err.message || 'Ошибка воспроизведения');
    } finally {
      setIsLoading(false);
    }
  };

  // Play/Pause
  const togglePlayPause = () => {
    dispatch(togglePlay());
    setIsPlayingLocal(!isPlayingLocal);
  };

  // Закрыть и вернуть к поиску
  const handleClose = () => {
    setStep('search');
    setSearchQuery('');
    setSearchResults([]);
    setCurrentTrack(null);
    setError('');
    onClose();
  };

  // Обработка Enter в поле поиска
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-lg p-6 w-[500px] max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Шаг 1: Поиск */}
        {step === 'search' && (
          <>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              Слушать музыку онлайн
            </h3>

            <p className="text-sm text-dark-400 mb-4">
              Поиск и воспроизведение музыки из YouTube Music
            </p>

            <div className="relative">
              <div className="flex gap-2 mb-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Введите название трека или артиста..."
                  className="flex-1 px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-white placeholder-dark-500"
                  autoFocus
                />
                <button
                  onClick={handleSearch}
                  disabled={isLoading}
                  className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-dark-600 disabled:cursor-not-allowed rounded-lg transition-colors font-medium text-white flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Поиск
                </button>
              </div>
              
              {/* Подсказки */}
              {suggestions.length > 0 && searchQuery.length >= 2 && (
                <div className="absolute z-10 w-full bg-dark-700 border border-dark-600 rounded-lg mt-1 max-h-48 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSearchQuery(suggestion);
                        setSuggestions([]);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-dark-600 text-sm text-white first:rounded-t-lg last:rounded-b-lg"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Популярные запросы */}
            <div className="mb-4">
              <p className="text-sm text-dark-400 mb-2">Популярное:</p>
              <div className="flex flex-wrap gap-2">
                {['Lo-fi Hip Hop', 'Chill Music', 'Pop Hits 2025', 'Rock Classics', 'Jazz Relax'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSearchQuery(tag);
                    }}
                    className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-full text-sm text-white transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-auto">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors font-medium text-white"
              >
                Закрыть
              </button>
            </div>
          </>
        )}

        {/* Шаг 2: Результаты поиска */}
        {step === 'results' && (
          <>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              Результаты: {searchQuery}
            </h3>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="animate-spin h-8 w-8 text-primary-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-dark-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-dark-400">Ничего не найдено</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 mb-4 max-h-96">
                {searchResults.map((track, index) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-3 bg-dark-700/50 hover:bg-dark-600 rounded-lg cursor-pointer transition-colors group"
                    onClick={() => playTrack(track)}
                  >
                    <span className="text-sm text-dark-500 w-6 flex-shrink-0">{index + 1}</span>
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{track.title}</p>
                      <p className="text-xs text-dark-400 truncate">{track.artist}</p>
                    </div>
                    <span className="text-xs text-dark-500">{track.duration}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playTrack(track);
                      }}
                      className="p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary-500/20 rounded-full"
                    >
                      <svg className="w-5 h-5 text-primary-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('search')}
                className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors font-medium text-white"
              >
                Назад
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors font-medium text-white"
              >
                Закрыть
              </button>
            </div>
          </>
        )}

        {/* Шаг 3: Воспроизведение */}
        {step === 'playing' && currentTrack && (
          <>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
              <svg className="w-6 h-6 text-primary-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              Сейчас играет
            </h3>

            <div className="flex flex-col items-center py-8">
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-48 h-48 rounded-lg object-cover shadow-2xl mb-6"
              />
              <h4 className="text-lg font-semibold text-white text-center mb-1">{currentTrack.title}</h4>
              <p className="text-sm text-dark-400">{currentTrack.artist}</p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('results')}
                className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors font-medium text-white"
              >
                К результатам
              </button>
              <button
                onClick={togglePlayPause}
                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium text-white flex items-center justify-center gap-2"
              >
                {isPlaying ? (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                    Пауза
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Play
                  </>
                )}
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors font-medium text-white"
              >
                Закрыть
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default MusicOnlineModal;
