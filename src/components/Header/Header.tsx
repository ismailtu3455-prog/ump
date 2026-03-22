import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import { toggleSidebar } from '@store/uiSlice';
import SettingsModal from '@components/Settings/SettingsModal';

function Header() {
  const dispatch = useAppDispatch();
  const currentFile = useAppSelector(state => state.player.currentFile);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="h-14 bg-gradient-to-r from-dark-900 via-dark-800 to-dark-900 border-b border-dark-700/50 flex items-center px-4 gap-4 flex-shrink-0 shadow-lg">
        {/* Кнопка Sidebar */}
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="p-2 hover:bg-dark-700/50 rounded-xl transition-all duration-200 group relative overflow-hidden"
          title="Плейлист"
        >
          <div className="absolute inset-0 bg-primary-500/10 scale-0 group-hover:scale-100 transition-transform duration-300" />
          <svg className="w-5 h-5 text-dark-300 group-hover:text-primary-400 transition-colors relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Разделитель */}
        <div className="w-px h-6 bg-gradient-to-b from-transparent via-dark-600 to-transparent" />

        {/* Текущий файл */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          {currentFile ? (
            <div className="flex items-center gap-3 min-w-0 group">
              <div className="w-9 h-9 rounded-lg bg-dark-700 flex items-center justify-center flex-shrink-0 overflow-hidden group-hover:ring-2 ring-primary-500/50 transition-all duration-300">
                {currentFile.type === 'image' ? (
                  <img src={currentFile.path} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-5 h-5 text-primary-400 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate group-hover:text-primary-400 transition-colors">{currentFile.name}</p>
                <p className="text-xs text-dark-400 uppercase">{currentFile.format}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-dark-400">
              <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-sm">Перетащите файлы для воспроизведения</span>
            </div>
          )}
        </div>

        {/* Правая часть - кнопки */}
        <div className="flex items-center gap-1">
          {/* Telegram */}
          <a
            href="https://t.me/universalmediplayer"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-blue-500/10 rounded-xl transition-all duration-200 group"
            title="Telegram канал"
          >
            <svg className="w-5 h-5 text-dark-300 group-hover:text-blue-400 group-hover:scale-110 transition-all" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.321c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
          </a>

          {/* Поддержать */}
          <a
            href="https://yoomoney.ru/to/4100118076958129"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-green-500/10 rounded-xl transition-all duration-200 group"
            title="Поддержать проект"
          >
            <svg className="w-5 h-5 text-dark-300 group-hover:text-green-400 group-hover:scale-110 transition-all" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.27-1.95-2.94-3.66-3.42z"/>
            </svg>
          </a>

          {/* GitHub */}
          <a
            href="https://github.com/ismailtu3455-prog/ump"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-dark-600/50 rounded-xl transition-all duration-200 group"
            title="GitHub репозиторий"
          >
            <svg className="w-5 h-5 text-dark-300 group-hover:text-white group-hover:scale-110 transition-all" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>

          {/* Настройки */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-primary-500/10 rounded-xl transition-all duration-200 group"
            title="Настройки"
          >
            <svg className="w-5 h-5 text-dark-300 group-hover:text-primary-400 group-hover:rotate-90 transition-all duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}

export default Header;
