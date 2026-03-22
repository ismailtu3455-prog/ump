import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import { setTheme, setWindowSettings, setLanguage, setPlayerSettings, setHotkey, resetHotkeys } from '@store/uiSlice';
import { addNotification } from '@store/uiSlice';
import { translations } from '@utils/translations';
import { UIState } from '@/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const dispatch = useAppDispatch();
  const theme = useAppSelector(state => state.ui.theme);
  const language = useAppSelector(state => state.ui.language);
  const windowSettings = useAppSelector(state => state.ui.windowSettings);
  const playerSettings = useAppSelector(state => state.ui.playerSettings);
  const hotkeys = useAppSelector(state => state.ui.hotkeys);
  const [opacity, setOpacity] = useState(windowSettings.opacity || 75);
  const [localSettings, setLocalSettings] = useState(windowSettings);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [accentColor, setAccentColor] = useState('#ef4444');
  const [activeTab, setActiveTab] = useState<'general' | 'player' | 'hotkeys'>('general');
  const [autoplayEnabled, setAutoplayEnabled] = useState(playerSettings?.autoplayEnabled ?? true);
  const [autoplayDelay, setAutoplayDelay] = useState(playerSettings?.autoplayDelay ?? 3);
  const [recordingHotkey, setRecordingHotkey] = useState<string | null>(null);

  const t = translations[language];

  // Синхронизация с Redux при изменении
  useEffect(() => {
    setAutoplayEnabled(playerSettings?.autoplayEnabled ?? true);
    setAutoplayDelay(playerSettings?.autoplayDelay ?? 3);
  }, [playerSettings]);

  // Загрузка текущей прозрачности при открытии
  useEffect(() => {
    if (isOpen) {
      const style = getComputedStyle(document.documentElement);
      const opacityVar = style.getPropertyValue('--bg-opacity').trim();
      if (opacityVar) {
        setOpacity(Math.round(parseFloat(opacityVar) * 100));
      }
    }
  }, [isOpen]);

  // Обработка записи горячей клавиши
  useEffect(() => {
    if (!recordingHotkey || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();

      if (e.key === 'Escape') {
        setRecordingHotkey(null);
        return;
      }

      let keyCode = e.code;

      // Для модификаторов
      if (e.ctrlKey) keyCode = 'Ctrl+' + e.code;
      if (e.shiftKey) keyCode = 'Shift+' + keyCode;
      if (e.altKey) keyCode = 'Alt+' + keyCode;

      const keyMap: Record<string, keyof UIState['hotkeys']> = {
        'playPause': 'playPause',
        'next': 'next',
        'previous': 'previous',
        'fullscreen': 'fullscreen',
        'volumeUp': 'volumeUp',
        'volumeDown': 'volumeDown',
        'seekForward': 'seekForward',
        'seekBackward': 'seekBackward',
      };

      const hotkeyKey = keyMap[recordingHotkey] || 'playPause';
      dispatch(setHotkey({ key: hotkeyKey, value: keyCode }));
      setRecordingHotkey(null);

      dispatch(addNotification({
        type: 'success',
        title: 'Клавиша назначена',
        message: `${recordingHotkey} → ${keyCode}`,
      }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recordingHotkey, isOpen, dispatch]);

  if (!isOpen) return null;

  const handleSave = async (e?: React.MouseEvent) => {
    e?.stopPropagation();

    const settingsToSave = {
      opacity,
      alwaysOnTop: localSettings.alwaysOnTop,
      width: localSettings.width,
      height: localSettings.height,
      accentColor,
    };

    dispatch(setWindowSettings(settingsToSave));
    dispatch(setPlayerSettings({ autoplayEnabled, autoplayDelay }));

    if (window.electronAPI) {
      await window.electronAPI.setWindowSettings({
        width: settingsToSave.width,
        height: settingsToSave.height,
        alwaysOnTop: settingsToSave.alwaysOnTop,
      });
    }

    document.documentElement.style.setProperty('--bg-opacity', (opacity / 100).toString());
    document.documentElement.style.setProperty('--primary-color', accentColor);
    document.body.className = theme === 'light' ? 'theme-light' : '';

    dispatch(addNotification({
      type: 'success',
      title: 'Настройки сохранены',
      message: 'Изменения успешно применены',
    }));

    onClose();
  };

  const handleOpacityChange = (value: number) => {
    setOpacity(value);
    document.documentElement.style.setProperty('--bg-opacity', (value / 100).toString());
  };

  const presetColors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-dark-800 rounded-2xl p-6 w-[480px] max-w-md modal-content animate-slideUp shadow-2xl border border-dark-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок с анимацией */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2 text-white">
            <svg className="w-6 h-6 text-primary-500 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {t.settings}
          </h3>
        </div>

        {/* Вкладки */}
        <div className="flex gap-2 mb-6 p-1 bg-dark-700 rounded-xl">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-2 px-4 rounded-lg transition-all duration-300 font-medium ${
              activeTab === 'general'
                ? 'bg-primary-600 text-white shadow-lg scale-105'
                : 'text-dark-400 hover:text-white hover:bg-dark-600'
            }`}
          >
            <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Основные
          </button>
          <button
            onClick={() => setActiveTab('player')}
            className={`flex-1 py-2 px-4 rounded-lg transition-all duration-300 font-medium ${
              activeTab === 'player'
                ? 'bg-primary-600 text-white shadow-lg scale-105'
                : 'text-dark-400 hover:text-white hover:bg-dark-600'
            }`}
          >
            <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Плеер
          </button>
          <button
            onClick={() => setActiveTab('hotkeys')}
            className={`flex-1 py-2 px-4 rounded-lg transition-all duration-300 font-medium ${
              activeTab === 'hotkeys'
                ? 'bg-primary-600 text-white shadow-lg scale-105'
                : 'text-dark-400 hover:text-white hover:bg-dark-600'
            }`}
          >
            <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            Клавиши
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto pr-2 custom-scrollbar">
          {activeTab === 'general' ? (
            <div className="space-y-4 animate-fadeIn">
              {/* Тема */}
              <div className="p-4 bg-dark-700/50 rounded-xl border border-dark-600 hover:border-primary-500/50 transition-all duration-300">
                <label className="block text-sm font-medium mb-3 text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  {t.theme}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      dispatch(setTheme('dark'));
                      document.body.className = '';
                    }}
                    className={`flex-1 py-2.5 rounded-xl transition-all duration-300 ${
                      theme === 'dark' ? 'bg-primary-600 text-white shadow-lg scale-105' : 'bg-dark-600 hover:bg-dark-500 text-white'
                    }`}
                  >
                    🌙 {t.darkTheme}
                  </button>
                  <button
                    onClick={() => {
                      dispatch(setTheme('light'));
                      document.body.className = 'theme-light';
                    }}
                    className={`flex-1 py-2.5 rounded-xl transition-all duration-300 ${
                      theme === 'light' ? 'bg-primary-600 text-white shadow-lg scale-105' : 'bg-dark-600 hover:bg-dark-500 text-white'
                    }`}
                  >
                    ☀️ {t.lightTheme}
                  </button>
                </div>
              </div>

              {/* Язык и Цвет */}
              <div className="grid grid-cols-2 gap-3">
                {/* Язык */}
                <div className="p-4 bg-dark-700/50 rounded-xl border border-dark-600 hover:border-primary-500/50 transition-all duration-300">
                  <label className="block text-sm font-medium mb-3 text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.148" />
                    </svg>
                    Язык
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => dispatch(setLanguage('ru'))}
                      className={`flex-1 py-2 px-3 rounded-xl transition-all duration-300 text-sm font-medium ${
                        language === 'ru' ? 'bg-primary-600 text-white shadow-lg scale-105' : 'bg-dark-600 hover:bg-dark-500 text-white'
                      }`}
                    >
                      🇷🇺 RU
                    </button>
                    <button
                      onClick={() => dispatch(setLanguage('en'))}
                      className={`flex-1 py-2 px-3 rounded-xl transition-all duration-300 text-sm font-medium ${
                        language === 'en' ? 'bg-primary-600 text-white shadow-lg scale-105' : 'bg-dark-600 hover:bg-dark-500 text-white'
                      }`}
                    >
                      🇺🇸 EN
                    </button>
                  </div>
                </div>

                {/* Цвет окна */}
                <div className="p-4 bg-dark-700/50 rounded-xl border border-dark-600 hover:border-primary-500/50 transition-all duration-300">
                  <label className="block text-sm font-medium mb-3 text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    Цвет
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      className="w-full py-2 px-3 rounded-xl border border-dark-500 hover:border-primary-500 transition-all duration-300 flex items-center gap-2 hover:scale-105"
                      style={{ backgroundColor: accentColor }}
                    >
                      <div className="w-4 h-4 rounded-full border-2 border-white/50 shadow-lg" style={{ backgroundColor: accentColor }} />
                      <span className="text-sm text-white font-medium">{accentColor}</span>
                    </button>
                    
                    {showColorPicker && (
                      <div className="absolute top-full left-0 mt-2 p-3 bg-dark-700 rounded-xl shadow-2xl z-50 border border-dark-600 animate-slideDown">
                        <div className="grid grid-cols-4 gap-2 mb-3">
                          {presetColors.map((color) => (
                            <button
                              key={color}
                              onClick={() => {
                                setAccentColor(color);
                                setShowColorPicker(false);
                              }}
                              className="w-8 h-8 rounded-full border-2 border-white/20 hover:border-white transition-all duration-300 hover:scale-125 shadow-lg"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={accentColor}
                            onChange={(e) => setAccentColor(e.target.value)}
                            className="w-8 h-8 rounded-lg cursor-pointer border-0"
                          />
                          <span className="text-xs text-dark-400">Свой цвет</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Прозрачность */}
              <div className="p-4 bg-dark-700/50 rounded-xl border border-dark-600 hover:border-primary-500/50 transition-all duration-300">
                <label className="block text-sm font-medium mb-3 text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {t.opacity}: <span className="text-primary-400 font-bold">{opacity}%</span>
                </label>
                <input
                  type="range"
                  min="25"
                  max="100"
                  value={opacity}
                  onChange={(e) => handleOpacityChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
                <div className="flex justify-between text-xs text-dark-400 mt-2">
                  <span>🌫️ {t.transparent}</span>
                  <span>🔒 {t.solid}</span>
                </div>
              </div>

              {/* Поверх всех окон */}
              <div className="p-4 bg-dark-700/50 rounded-xl border border-dark-600 hover:border-primary-500/50 transition-all duration-300 flex items-center justify-between">
                <label className="text-sm font-medium text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  {t.alwaysOnTop}
                </label>
                <button
                  onClick={() => {
                    const newValue = !localSettings.alwaysOnTop;
                    setLocalSettings({ ...localSettings, alwaysOnTop: newValue });
                  }}
                  className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                    localSettings.alwaysOnTop ? 'bg-primary-600' : 'bg-dark-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-300 ${
                      localSettings.alwaysOnTop ? 'left-8' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Размер окна */}
              <div className="p-4 bg-dark-700/50 rounded-xl border border-dark-600 hover:border-primary-500/50 transition-all duration-300">
                <label className="block text-sm font-medium mb-3 text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  {t.windowSize}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-dark-400 mb-1 block">{t.width}</span>
                    <input
                      type="number"
                      value={localSettings.width}
                      onChange={(e) => setLocalSettings({ ...localSettings, width: parseInt(e.target.value) || 1400 })}
                      className="w-full px-3 py-2.5 bg-dark-600 border border-dark-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-white transition-all duration-300 hover:border-primary-500/50"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-dark-400 mb-1 block">{t.height}</span>
                    <input
                      type="number"
                      value={localSettings.height}
                      onChange={(e) => setLocalSettings({ ...localSettings, height: parseInt(e.target.value) || 900 })}
                      className="w-full px-3 py-2.5 bg-dark-600 border border-dark-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-white transition-all duration-300 hover:border-primary-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Управление данными */}
              <div className="pt-4 border-t border-dark-700">
                <label className="block text-sm font-medium mb-2 text-white">{t.data}</label>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      if (confirm('Очистить историю просмотров?')) {
                        dispatch(addNotification({
                          type: 'info',
                          title: 'История очищена',
                          message: 'История просмотров успешно очищена',
                        }));
                      }
                    }}
                    className="w-full py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors text-sm text-left px-4 text-white"
                  >
                    Очистить историю
                  </button>
                  <button
                    onClick={() => {
                      dispatch(addNotification({
                        type: 'success',
                        title: 'Экспорт выполнен',
                        message: 'Избранное экспортировано в favorites.json',
                      }));
                    }}
                    className="w-full py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors text-sm text-left px-4 text-white"
                  >
                    Экспорт избранного
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'player' ? (
            /* Вкладка плеера */
            <div className="space-y-4 animate-fadeIn">
              {/* Авто-воспроизведение с задержкой */}
              <div className="p-4 bg-dark-700/50 rounded-xl border border-dark-600">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                    </svg>
                    Задержка между видео
                  </span>
                  <button
                    onClick={() => setAutoplayEnabled(!autoplayEnabled)}
                    className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                      autoplayEnabled ? 'bg-primary-600' : 'bg-dark-600'
                    }`}
                    title={autoplayEnabled ? 'Включено' : 'Выключено'}
                  >
                    <div
                      className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-300 ${
                        autoplayEnabled ? 'left-8' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-dark-400 mb-3">
                  {autoplayEnabled 
                    ? 'Автоматический запуск следующего видео с задержкой' 
                    : 'Остановить после завершения текущего видео'}
                </p>
                
                <div className={`transition-opacity duration-300 ${autoplayEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                  <label className="text-xs text-dark-400 mb-2 block">
                    Задержка: <span className="text-primary-400 font-bold">{autoplayDelay} сек</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={autoplayDelay}
                    onChange={(e) => setAutoplayDelay(parseInt(e.target.value))}
                    className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                  <div className="flex justify-between text-xs text-dark-500 mt-1">
                    <span>0 сек (нет)</span>
                    <span>5 сек</span>
                    <span>10 сек</span>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg">
                  <p className="text-xs text-primary-300">
                    💡 <strong>Совет:</strong> В режиме повтора "⟲1 Один" видео воспроизводится бесконечно без задержки
                  </p>
                </div>
              </div>
              
              {/* Режим повтора */}
              <div className="p-4 bg-dark-700/50 rounded-xl border border-dark-600">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-primary-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v5z"/>
                  </svg>
                  <span className="text-sm font-medium text-white">Режим повтора</span>
                </div>
                <p className="text-xs text-dark-400 mb-3">
                  Настройте повтор воспроизведения в плеере (кнопка ⟲)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-dark-600/50 rounded-lg">
                    <p className="text-xs text-white font-medium">⟲ Без повтора</p>
                    <p className="text-xs text-dark-500">Остановить в конце</p>
                  </div>
                  <div className="p-2 bg-dark-600/50 rounded-lg">
                    <p className="text-xs text-white font-medium">⟲ Все</p>
                    <p className="text-xs text-dark-500">Зациклить плейлист</p>
                  </div>
                  <div className="p-2 bg-dark-600/50 rounded-lg">
                    <p className="text-xs text-white font-medium">⟲1 Один</p>
                    <p className="text-xs text-dark-500">Повторять текущий</p>
                  </div>
                  <div className="p-2 bg-dark-600/50 rounded-lg">
                    <p className="text-xs text-white font-medium">⟲ Случайно</p>
                    <p className="text-xs text-dark-500">В разброс</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Вкладка горячих клавиш */
            <div className="space-y-3 animate-fadeIn">
              <div className="p-4 bg-dark-700/50 rounded-xl border border-dark-600">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    Горячие клавиши
                  </h4>
                  <button
                    onClick={() => {
                      dispatch(resetHotkeys());
                      dispatch(addNotification({
                        type: 'info',
                        title: 'Сброшено',
                        message: 'Горячие клавиши сброшены к значениям по умолчанию',
                      }));
                    }}
                    className="text-xs px-3 py-1.5 bg-dark-600 hover:bg-dark-500 rounded-lg transition-colors text-white"
                  >
                    Сбросить
                  </button>
                </div>
                
                <div className="space-y-2">
                  {Object.entries(hotkeys).map(([action, key]) => (
                    <div
                      key={action}
                      className="flex items-center justify-between p-3 bg-dark-600/50 rounded-lg hover:bg-dark-600 transition-all duration-300 group"
                    >
                      <span className="text-sm text-white capitalize">
                        {action.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <button
                        onClick={() => {
                          setRecordingHotkey(action);
                          dispatch(addNotification({
                            type: 'info',
                            title: 'Назначение клавиши',
                            message: 'Нажмите нужную клавишу...',
                          }));
                        }}
                        className={`px-4 py-2 border rounded-lg text-xs font-mono transition-all duration-300 ${
                          recordingHotkey === action
                            ? 'border-primary-500 bg-primary-500/20 text-primary-400 animate-pulse'
                            : 'border-dark-500 bg-dark-800 text-white hover:border-primary-500'
                        }`}
                      >
                        {recordingHotkey === action ? 'Нажмите...' : key}
                      </button>
                    </div>
                  ))}
                </div>
                
                <p className="text-xs text-dark-400 mt-4">
                  Нажмите на клавишу чтобы изменить назначение. Для отмены нажмите Escape.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-dark-700">
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 rounded-xl transition-all duration-300 font-medium text-white shadow-lg hover:shadow-primary-500/30 hover:scale-105"
          >
            💾 {t.save}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-dark-700 hover:bg-dark-600 rounded-xl transition-all duration-300 font-medium text-white hover:scale-105"
          >
            ✕ {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
