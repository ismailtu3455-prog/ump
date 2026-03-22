import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import { addFilesToPlaylist, setCurrentIndex } from '@store/playlistSlice';
import { setCurrentFile, setIsPlaying } from '@store/playerSlice';
import Player from '@components/Player/Player';
import Sidebar from '@components/Sidebar/Sidebar';
import Notifications from '@components/Notifications/Notifications';
import Header from '@components/Header/Header';
import { generateId, detectMediaType, getFileExtension } from '@/utils/fileUtils';

function App() {
  const dispatch = useAppDispatch();
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const isSidebarOpen = useAppSelector(state => state.ui.isSidebarOpen);
  const theme = useAppSelector(state => state.ui.theme);
  const opacity = useAppSelector(state => state.ui.windowSettings.opacity || 75);

  // Адаптация ширины sidebar при изменении размера окна
  useEffect(() => {
    const handleResize = () => {
      const windowWidth = window.innerWidth;
      const newWidth = Math.min(400, Math.max(200, Math.floor(windowWidth * 0.2)));
      setSidebarWidth(newWidth);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Вызываем сразу при монтировании
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Пустой массив — вызываем только при монтировании

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

  useEffect(() => {
    document.body.className = theme === 'light' ? 'theme-light' : '';
    const opacityValue = opacity / 100;
    document.documentElement.style.setProperty('--bg-opacity', opacityValue.toString());
  }, [theme, opacity]);

  // Адаптация ширины sidebar при изменении размера окна
  useEffect(() => {
    const handleResize = () => {
      const windowWidth = window.innerWidth;
      const maxSidebarWidth = Math.min(600, windowWidth * 0.4);
      const minSidebarWidth = Math.max(200, windowWidth * 0.15);
      
      if (sidebarWidth > maxSidebarWidth) {
        setSidebarWidth(maxSidebarWidth);
      } else if (sidebarWidth < minSidebarWidth) {
        setSidebarWidth(minSidebarWidth);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarWidth]);

  return (
    <div className="flex flex-col h-screen bg-dark-950">
      <Notifications />

      {/* Header - кастомный заголовок окна */}
      <Header />

      {/* Main content */}
      <div
        className="flex flex-1 overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            // Закрытие обрабатывается в самом SettingsModal
          }
        }}
      >
        {/* Sidebar с анимацией */}
        {isSidebarOpen && (
          <div
            className="relative bg-dark-900 border-r border-dark-800 flex-shrink-0 animate-slideInLeft"
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
        <div className="flex-1 flex items-center justify-center bg-dark-950 overflow-hidden">
          <Player />
        </div>
      </div>
    </div>
  );
}

export default App;
