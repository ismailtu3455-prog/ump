import { useState, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import {
  createPlaylist,
  createPlaylistWithFiles,
  deletePlaylist,
  setActivePlaylist,
  addFilesToPlaylist,
  setCurrentIndex,
  moveFileBetweenPlaylists,
  removeFileFromPlaylist,
  renamePlaylist,
  setSearchQuery,
  toggleFavorite,
} from '@store/playlistSlice';
import { setCurrentFile, setIsPlaying } from '@store/playerSlice';
import { addNotification } from '@store/uiSlice';
import { detectMediaType, getFileExtension, generateId } from '@/utils/fileUtils';

function Sidebar() {
  const dispatch = useAppDispatch();
  const playlists = useAppSelector(state => state.playlist.playlists);
  const activePlaylistId = useAppSelector(state => state.playlist.activePlaylistId);
  const currentIndex = useAppSelector(state => state.playlist.currentIndex);
  const searchQuery = useAppSelector(state => state.playlist.searchQuery);
  const isSidebarOpen = useAppSelector(state => state.ui.isSidebarOpen);

  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedFile, setDraggedFile] = useState<{ fileId: string; playlistId: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const folderInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const activePlaylist = playlists.find(p => p.id === activePlaylistId);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingId]);

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      dispatch(createPlaylist(newPlaylistName));
      dispatch(addNotification({
        type: 'success',
        title: 'Плейлист создан',
        message: `Плейлист "${newPlaylistName}" успешно создан`,
      }));
      setNewPlaylistName('');
      setShowNewPlaylist(false);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    const playlist = playlists.find(p => p.id === id);
    if (playlist?.isSystem) {
      dispatch(addNotification({
        type: 'error',
        title: 'Ошибка',
        message: 'Системные плейлисты нельзя удалить',
      }));
      return;
    }

    if (confirm(`Удалить плейлист "${playlist?.name}"?`)) {
      // Если удаляемый плейлист активен и сейчас воспроизводится — останавливаем
      if (activePlaylistId === id) {
        dispatch(setCurrentFile(null));
        dispatch(setIsPlaying(false));
        dispatch(setActivePlaylist('recent'));
      }
      
      // Сначала удаляем папку с диска
      if (window.electronAPI && playlist) {
        try {
          const result = await window.electronAPI.deletePlaylistFolder(playlist.name);
          console.log('Delete playlist folder result:', result);
          console.log('Playlist folder deleted from disk:', playlist.name);
        } catch (error) {
          console.error('Error deleting folder:', error);
        }
      }
      
      // Затем удаляем из Redux
      dispatch(deletePlaylist(id));
      dispatch(addNotification({
        type: 'info',
        title: 'Плейлист удалён',
        message: `Плейлист "${playlist?.name}" удалён`,
      }));
    }
  };

  const handleRenamePlaylist = (id: string) => {
    if (renameValue.trim()) {
      dispatch(renamePlaylist({ playlistId: id, newName: renameValue }));
      setRenamingId(null);
      dispatch(addNotification({
        type: 'success',
        title: 'Переименовано',
        message: `Плейлист переименован в "${renameValue}"`,
      }));
    }
  };

  const handleFilesAdded = (files: File[]) => {
    const mediaFiles = files.map(file => ({
      id: generateId(),
      name: file.name,
      path: URL.createObjectURL(file),
      type: detectMediaType(file.name) || 'video',
      format: getFileExtension(file.name),
      size: file.size,
      addedAt: Date.now(),
      isBlob: true,
    }));
    dispatch(addFilesToPlaylist({ playlistId: activePlaylistId || 'recent', files: mediaFiles }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      file => detectMediaType(file.name) !== null
    );
    if (files.length > 0) {
      handleFilesAdded(files);
    }
  };

  const handleFileSelect = () => {
    window.electronAPI?.openFileDialog();
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const firstFile = files[0];
    const pathParts = firstFile.webkitRelativePath.split(/[\\/]/);
    const folderName = pathParts.length > 1 ? pathParts[0] : 'Папка';

    const mediaFiles = Array.from(files).filter(
      file => detectMediaType(file.name) !== null
    ).map(file => ({
      id: generateId(),
      name: file.name,
      path: URL.createObjectURL(file),
      type: detectMediaType(file.name) || 'video',
      format: getFileExtension(file.name),
      size: file.size,
      addedAt: Date.now(),
      isBlob: true,
    }));

    if (mediaFiles.length === 0) {
      e.target.value = '';
      return;
    }

    // Проверяем существует ли уже плейлист с таким именем
    const existingPlaylist = playlists.find(p => p.name === folderName);
    
    if (existingPlaylist) {
      // Добавляем файлы в существующий плейлист
      dispatch(addFilesToPlaylist({ playlistId: existingPlaylist.id, files: mediaFiles }));
      dispatch(setActivePlaylist(existingPlaylist.id));
    } else {
      // Создаём новый плейлист и получаем его ID
      const newPlaylistId = `pl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Создаём плейлист вручную с известным ID и сразу добавляем файлы
      const newPlaylist = {
        id: newPlaylistId,
        name: folderName,
        files: mediaFiles,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isSystem: false,
      };
      
      dispatch(createPlaylistWithFiles({ playlist: newPlaylist }));
    }
    
    dispatch(addNotification({
      type: 'success',
      title: 'Папка добавлена',
      message: `Добавлено ${mediaFiles.length} файлов`,
    }));
    e.target.value = '';
  };

  // Загрузка сохранённых плейлистов при старте
  useEffect(() => {
    const loadSavedPlaylists = async () => {
      if (!window.electronAPI) {
        console.log('Electron API not available');
        return;
      }
      try {
        const result = await window.electronAPI.loadSavedPlaylists();
        console.log('Load saved playlists result:', result);

        if (result?.success && result.playlists?.length > 0) {
          for (const playlistData of result.playlists) {
            // Создаём плейлист если не существует
            let targetPlaylist = playlists.find(p => p.name === playlistData.name);
            let playlistId = targetPlaylist?.id;
            
            if (!targetPlaylist) {
              // Генерируем ID заранее
              playlistId = `pl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

              // Создаём плейлист
              const newPlaylist = {
                id: playlistId,
                name: playlistData.name,
                files: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                isSystem: false,
              };

              dispatch({
                type: 'playlist/createPlaylistWithFiles',
                payload: { playlist: newPlaylist },
              });
              console.log('Created playlist:', playlistData.name);
            }

            // Добавляем сохранённые файлы
            if (playlistData.savedFiles && playlistData.savedFiles.length > 0) {
              const savedMediaFiles = playlistData.savedFiles.map((savedFile: any, index: number) => ({
                id: `saved-${Date.now()}-${index}`,
                name: savedFile.name,
                path: savedFile.path,
                type: detectMediaType(savedFile.name) || 'video',
                format: getFileExtension(savedFile.name),
                size: 0,
                addedAt: Date.now(),
                isSaved: true,
              }));

              dispatch(addFilesToPlaylist({
                playlistId: playlistId!,
                files: savedMediaFiles
              }));
              console.log('Added files to playlist:', playlistData.name, '- files:', savedMediaFiles.length);
            }
          }
        }
      } catch (error) {
        console.error('Error loading saved playlists:', error);
      }
    };

    // Загружаем только один раз при монтировании
    loadSavedPlaylists();
  }, []);

  // Слушаем файлы из Electron dialog
  useEffect(() => {
    const handleFilesSelected = (filePaths: string[]) => {
      if (!filePaths || filePaths.length === 0) return;

      const mediaFiles = filePaths.map(filePath => ({
        id: generateId(),
        name: filePath.split(/[\\/]/).pop() || 'Unknown',
        path: filePath,
        type: detectMediaType(filePath) || 'video',
        format: getFileExtension(filePath),
        size: 0,
        addedAt: Date.now(),
      }));

      dispatch(addFilesToPlaylist({ playlistId: activePlaylistId || 'recent', files: mediaFiles }));
    };

    window.electronAPI?.on('files-selected', handleFilesSelected);
    return () => {
      window.electronAPI?.removeAllListeners('files-selected');
    };
  }, [dispatch, activePlaylistId]);

  const handleSavePlaylist = async (playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist || playlist.isSystem) {
      dispatch(addNotification({
        type: 'error',
        title: 'Ошибка',
        message: 'Можно сохранять только пользовательские плейлисты',
      }));
      return;
    }

    console.log('=== Save Playlist ===');
    console.log('Playlist ID:', playlistId);
    console.log('Playlist name:', playlist.name);
    console.log('Total files:', playlist.files.length);
    console.log('Files:', playlist.files.map(f => ({ name: f.name, path: f.path, isBlob: f.isBlob })));

    const localFiles = playlist.files.filter(f =>
      !f.isLink && f.path && !f.path.startsWith('blob:') && !f.isBlob
    );
    const blobFiles = playlist.files.filter(f => f.path?.startsWith('blob:') || f.isBlob);

    console.log('Local files (can save):', localFiles.length);
    console.log('Blob files (cannot save):', blobFiles.length);

    if (localFiles.length === 0) {
      dispatch(addNotification({
        type: 'warning',
        title: 'Нет файлов',
        message: blobFiles.length > 0
          ? 'Файлы добавлены через Drag&Drop. Используйте кнопку "Добавить файлы" (Ctrl+O)'
          : 'Добавьте файлы перед сохранением',
      }));
      return;
    }

    if (!window.electronAPI) {
      dispatch(addNotification({
        type: 'error',
        title: 'Ошибка',
        message: 'Electron API недоступен',
      }));
      return;
    }

    try {
      console.log('Calling saveFilesToPlaylist with:', localFiles);
      const result = await window.electronAPI.saveFilesToPlaylist(playlist.name, localFiles);
      console.log('Save result:', result);
      
      if (result?.success) {
        dispatch(addNotification({
          type: 'success',
          title: 'Сохранено',
          message: `Скопировано файлов: ${result.copiedCount}`,
        }));
      } else {
        dispatch(addNotification({
          type: 'error',
          title: 'Ошибка',
          message: result?.error || 'Не удалось сохранить',
        }));
      }
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        title: 'Ошибка',
        message: String(error),
      }));
    }
  };

  const handlePlayFile = (index: number) => {
    if (!activePlaylist) return;
    const file = activePlaylist.files[index];
    if (file) {
      dispatch(setCurrentFile(file));
      dispatch(setCurrentIndex(index));
      dispatch(setIsPlaying(true));
    }
  };

  const handleFileDragStart = (e: React.DragEvent, fileId: string, playlistId: string) => {
    setDraggedFile({ fileId, playlistId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handlePlaylistDragOver = (e: React.DragEvent, playlistId: string) => {
    e.preventDefault();
    if (draggedFile && draggedFile.playlistId === 'recent' && playlistId !== 'recent') {
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handlePlaylistDrop = (e: React.DragEvent, toPlaylistId: string) => {
    e.preventDefault();
    if (draggedFile && draggedFile.playlistId === 'recent' && toPlaylistId !== 'recent') {
      dispatch(moveFileBetweenPlaylists({
        fromPlaylistId: draggedFile.playlistId,
        toPlaylistId,
        fileId: draggedFile.fileId,
      }));
      setDraggedFile(null);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    dispatch(removeFileFromPlaylist({ playlistId: activePlaylistId, fileId }));
  };

  const handleToggleFavorite = (fileId: string) => {
    dispatch(toggleFavorite({ playlistId: activePlaylistId, fileId }));
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSearchQuery(e.target.value));
  };

  const filteredFiles = activePlaylist?.files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  if (!isSidebarOpen) return null;

  return (
    <aside
      className={`w-full h-full flex flex-col bg-dark-800 ${
        isDragOver ? 'bg-primary-900/20' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="p-4 border-b border-dark-700 space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Плейлисты</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                console.log('Opening playlists folder...');
                try {
                  const result = await window.electronAPI?.openPlaylistsFolder();
                  console.log('Open folder result:', result);
                } catch (error) {
                  console.error('Error opening folder:', error);
                }
              }}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
              title="Открыть папку плейлистов"
            >
              <svg className="w-5 h-5 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
            </button>
            <button
              onClick={() => setShowNewPlaylist(true)}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
              title="Новый плейлист"
            >
              <svg className="w-5 h-5 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Поиск */}
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Поиск в плейлисте..."
          className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-white placeholder-dark-500"
        />

        <div className="flex gap-2">
          <button
            onClick={handleFileSelect}
            className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium text-sm text-white"
          >
            Добавить файлы
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors font-medium text-sm text-white"
          >
            Папка
          </button>
        </div>

        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-ignore - webkitdirectory is not in TypeScript types but works in browsers
          webkitdirectory=""
          accept="video/*,audio/*,image/*"
          onChange={handleFolderSelect}
          className="hidden"
        />
      </div>

      {/* Playlists list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {playlists.map(playlist => (
          <div
            key={playlist.id}
            className={`rounded-lg overflow-hidden transition-all ${
              activePlaylistId === playlist.id ? 'ring-2 ring-primary-500' : ''
            }`}
          >
            <div
              className="p-3 bg-dark-700/50 hover:bg-dark-700 cursor-pointer"
              onClick={() => dispatch(setActivePlaylist(playlist.id))}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <svg className="w-5 h-5 text-dark-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    {renamingId === playlist.id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRenamePlaylist(playlist.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenamePlaylist(playlist.id)}
                        className="w-full px-2 py-1 bg-dark-800 border border-primary-500 rounded text-sm focus:outline-none text-white"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <p className="font-medium text-white truncate">{playlist.name}</p>
                        <p className="text-xs text-dark-400">{playlist.files.length} файлов</p>
                      </>
                    )}
                  </div>
                </div>
                {!playlist.isSystem && (
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingId(playlist.id); setRenameValue(playlist.name); }}
                      className="p-1.5 hover:bg-blue-500/20 rounded transition-colors"
                      title="Переименовать"
                    >
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleSavePlaylist(playlist.id)}
                      className="p-1.5 hover:bg-green-500/20 rounded transition-colors"
                      title="Сохранить"
                    >
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeletePlaylist(playlist.id)}
                      className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                      title="Удалить"
                    >
                      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {activePlaylistId === playlist.id && filteredFiles.length > 0 && (
              <div
                className="bg-dark-700/30 max-h-48 overflow-y-auto"
                onDragOver={(e) => handlePlaylistDragOver(e, playlist.id)}
                onDrop={(e) => handlePlaylistDrop(e, playlist.id)}
              >
                {filteredFiles.map((file, index) => (
                  <div
                    key={file.id}
                    draggable
                    onDragStart={(e) => handleFileDragStart(e, file.id, playlist.id)}
                    className={`group p-2 px-4 flex items-center gap-3 cursor-pointer transition-colors ${
                      index === currentIndex
                        ? 'bg-primary-600/30 border-l-2 border-primary-500'
                        : 'hover:bg-dark-600/50'
                    }`}
                    onClick={() => handlePlayFile(index)}
                  >
                    <span className="text-sm text-dark-400 w-6 flex-shrink-0">
                      {index === currentIndex ? (
                        <svg className="w-4 h-4 text-primary-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      ) : (
                        <span className="text-xs">{index + 1}</span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate flex items-center gap-2 text-white">
                        {file.isLink && (
                          <svg className="w-3 h-3 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        )}
                        {file.isFavorite && (
                          <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        )}
                        {file.name}
                      </p>
                      <p className="text-xs text-dark-500 uppercase">{file.format}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleFavorite(file.id); }}
                        className="p-1 hover:bg-yellow-500/20 rounded transition-colors"
                        title="Избранное"
                      >
                        <svg className="w-3 h-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveFile(file.id); }}
                        className="p-1 hover:bg-red-500/20 rounded transition-colors"
                        title="Удалить"
                      >
                        <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New Playlist Modal */}
      {showNewPlaylist && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-80 mx-4">
            <h3 className="text-lg font-semibold mb-4 text-white">Новый плейлист</h3>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Название плейлиста"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500 text-white placeholder-dark-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreatePlaylist}
                className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors text-white font-medium"
              >
                Создать
              </button>
              <button
                onClick={() => { setShowNewPlaylist(false); setNewPlaylistName(''); }}
                className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors text-white font-medium"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
