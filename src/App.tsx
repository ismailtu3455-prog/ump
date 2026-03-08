import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import { addFilesToPlaylist, setCurrentIndex } from '@store/playlistSlice';
import { setCurrentFile, setIsPlaying } from '@store/playerSlice';
import Header from '@components/Header/Header';
import Player from '@components/Player/Player';
import Sidebar from '@components/Sidebar/Sidebar';
import Notifications from '@components/Notifications/Notifications';
import { generateId, detectMediaType, getFileExtension } from '@/utils/fileUtils';

function App() {
  const dispatch = useAppDispatch();
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const isSidebarOpen = useAppSelector(state => state.ui.isSidebarOpen);

  useEffect(() => {
    const handleFilesOpened = async (files: string[]) => {
      if (!files || files.length === 0) return;

      await new Promise(resolve => setTimeout(resolve, 100));

      const mediaFiles = files.map(filePath => ({
        id: generateId(),
        name: filePath.split(/[\\/]/).pop() || 'Unknown',
        path: filePath,
        type: detectMediaType(filePath) || 'video',
        format: getFileExtension(filePath),
        size: 0,
        addedAt: Date.now(),
      }));

      dispatch(addFilesToPlaylist({ playlistId: 'recent', files: mediaFiles }));

      if (mediaFiles.length > 0) {
        dispatch(setCurrentFile(mediaFiles[0]));
        dispatch(setCurrentIndex(0));
        dispatch(setIsPlaying(true));
      }
    };

    window.electronAPI?.on('files-opened', handleFilesOpened);
    
    // Обработка открытия файла из проводника
    window.electronAPI?.on('file-opened', handleFilesOpened);

    return () => {
      window.electronAPI?.off('files-opened', handleFilesOpened);
      window.electronAPI?.off('file-opened', handleFilesOpened);
    };
  }, [dispatch]);

  const startResizing = () => {
    setIsResizing(true);
  };

  const stopResizing = () => {
    setIsResizing(false);
  };

  const resize = (e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    }
  };

  useEffect(() => {
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResizing);
    return () => {
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing]);

  // Применение темы и прозрачности
  const theme = useAppSelector(state => state.ui.theme);
  const opacity = useAppSelector(state => state.ui.windowSettings.opacity || 75);
  
  useEffect(() => {
    document.body.className = theme === 'light' ? 'theme-light' : '';
    const opacityValue = opacity / 100;
    document.documentElement.style.setProperty('--bg-opacity', opacityValue.toString());
    console.log('Applied opacity:', opacityValue);
  }, [theme, opacity]);

  // Полноэкранная заставка с иконкой при загрузке
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="relative">
            {/* Сияние вокруг логотипа */}
            <div className="absolute inset-0 bg-primary-500/30 blur-3xl rounded-full animate-pulse" />
            {/* Логотип */}
            <img 
              src="./icon.png" 
              alt="Logo" 
              className="w-40 h-40 mx-auto mb-8 splash-logo relative z-10 drop-shadow-2xl" 
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 splash-title bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
            Universal Media Player
          </h1>
          <p className="text-dark-400 splash-subtitle flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
            Загрузка...
            <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
          </p>
          {/* Прогресс бар */}
          <div className="mt-6 w-48 h-1 bg-dark-700 rounded-full overflow-hidden mx-auto">
            <div className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full animate-pulse" style={{ width: '100%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Notifications />
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar слева */}
        {isSidebarOpen && (
          <div
            className="relative bg-dark-800 border-r border-dark-700 flex-shrink-0"
            style={{ width: sidebarWidth }}
          >
            <Sidebar />
            <div
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500 hover:w-1.5 transition-colors z-50"
              onMouseDown={startResizing}
            />
          </div>
        )}
        {/* Player по центру */}
        <div className="flex-1 flex items-center justify-center bg-dark-950">
          <Player />
        </div>
      </div>
    </div>
  );
}

export default App;
