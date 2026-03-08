import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import { setTheme, toggleTheme, setWindowSettings, setLanguage } from '@store/uiSlice';
import { clearHistory } from '@store/historySlice';
import { translations } from '@utils/translations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const dispatch = useAppDispatch();
  const theme = useAppSelector(state => state.ui.theme);
  const language = useAppSelector(state => state.ui.language);
  const windowSettings = useAppSelector(state => state.ui.windowSettings);
  const [opacity, setOpacity] = useState(windowSettings.opacity || 75);
  const [localSettings, setLocalSettings] = useState(windowSettings);

  const t = translations[language];

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

  if (!isOpen) return null;

  const handleSave = async () => {
    // Применяем настройки только если тумблеры включены
    const settingsToSave = {
      opacity,
      alwaysOnTop: localSettings.alwaysOnTop,
      width: localSettings.width,
      height: localSettings.height,
      // Аппаратное ускорение применяется только если включено
      hardwareAcceleration: localSettings.hardwareAcceleration !== false,
      // Автозагрузка применяется только если включена
      autoStart: localSettings.autoStart === true,
      screenshotHotkey: localSettings.screenshotHotkey || 'F11',
    };
    
    dispatch(setWindowSettings(settingsToSave));

    if (window.electronAPI) {
      await window.electronAPI.setWindowSettings({
        width: settingsToSave.width,
        height: settingsToSave.height,
        alwaysOnTop: settingsToSave.alwaysOnTop,
      });
      
      // Применяем автозагрузку только если включена, иначе отключаем
      await window.electronAPI.setAutoStart(settingsToSave.autoStart);
    }

    // Применяем прозрачность
    document.documentElement.style.setProperty('--bg-opacity', (opacity / 100).toString());
    
    // Применяем тему
    document.body.className = theme === 'light' ? 'theme-light' : '';

    onClose();
  };

  const handleClearHistory = () => {
    if (confirm('Очистить историю просмотров?')) {
      dispatch(clearHistory());
    }
  };

  const handleExportFavorites = () => {
    const data = JSON.stringify({ favorites: [] }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'favorites.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Применение прозрачности
  const handleOpacityChange = (value: number) => {
    setOpacity(value);
    document.documentElement.style.setProperty('--bg-opacity', (value / 100).toString());
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-lg p-6 w-[420px] max-w-md modal-content">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
          <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {t.settings}
        </h3>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Тема */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white">{t.theme}</label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  dispatch(setTheme('dark'));
                  document.body.className = '';
                }}
                className={`flex-1 py-2 rounded-lg transition-colors ${
                  theme === 'dark' ? 'bg-primary-600 text-white' : 'bg-dark-700 hover:bg-dark-600 text-white'
                }`}
              >
                {t.darkTheme}
              </button>
              <button
                onClick={() => {
                  dispatch(setTheme('light'));
                  document.body.className = 'theme-light';
                }}
                className={`flex-1 py-2 rounded-lg transition-colors ${
                  theme === 'light' ? 'bg-primary-600 text-white' : 'bg-dark-700 hover:bg-dark-600 text-white'
                }`}
              >
                {t.lightTheme}
              </button>
              <button
                onClick={() => {
                  dispatch(toggleTheme());
                  document.body.className = theme === 'dark' ? 'theme-light' : '';
                }}
                className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors text-white"
                title="Toggle"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Язык */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white">{t.language}</label>
            <div className="flex gap-2">
              <button
                onClick={() => dispatch(setLanguage('ru'))}
                className={`flex-1 py-2 rounded-lg transition-colors ${
                  language === 'ru' ? 'bg-primary-600 text-white' : 'bg-dark-700 hover:bg-dark-600 text-white'
                }`}
              >
                🇷🇺 {t.russian}
              </button>
              <button
                onClick={() => dispatch(setLanguage('en'))}
                className={`flex-1 py-2 rounded-lg transition-colors ${
                  language === 'en' ? 'bg-primary-600 text-white' : 'bg-dark-700 hover:bg-dark-600 text-white'
                }`}
              >
                🇺🇸 {t.english}
              </button>
            </div>
          </div>

          {/* Прозрачность */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white">
              {t.opacity}: {opacity}%
            </label>
            <input
              type="range"
              min="25"
              max="100"
              value={opacity}
              onChange={(e) => handleOpacityChange(parseInt(e.target.value))}
              className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-dark-400 mt-1">
              <span>{t.transparent}</span>
              <span>{t.solid}</span>
            </div>
          </div>

          {/* Поверх всех окон */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-white">{t.alwaysOnTop}</label>
            <button
              onClick={() => {
                const newValue = !localSettings.alwaysOnTop;
                setLocalSettings({ ...localSettings, alwaysOnTop: newValue });
              }}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                localSettings.alwaysOnTop ? 'bg-primary-600' : 'bg-dark-600'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  localSettings.alwaysOnTop ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Размер окна */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white">{t.windowSize}</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-dark-400">{t.width}</span>
                <input
                  type="number"
                  value={localSettings.width}
                  onChange={(e) => setLocalSettings({ ...localSettings, width: parseInt(e.target.value) || 1400 })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-white"
                />
              </div>
              <div>
                <span className="text-xs text-dark-400">{t.height}</span>
                <input
                  type="number"
                  value={localSettings.height}
                  onChange={(e) => setLocalSettings({ ...localSettings, height: parseInt(e.target.value) || 900 })}
                  className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-white"
                />
              </div>
            </div>
          </div>

          {/* Аппаратное ускорение и автозагрузка */}
          <div className="pt-4 border-t border-dark-700">
            <label className="block text-sm font-medium mb-3 text-white">{t.performance}</label>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-white">{t.hardwareAcceleration}</label>
                  <p className="text-xs text-dark-400">{t.hardwareAccelerationDesc}</p>
                </div>
                <button
                  onClick={() => {
                    const newValue = !localSettings.hardwareAcceleration;
                    setLocalSettings({ ...localSettings, hardwareAcceleration: newValue });
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    localSettings.hardwareAcceleration !== false ? 'bg-primary-600' : 'bg-dark-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      localSettings.hardwareAcceleration !== false ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-white">{t.autoStart}</label>
                  <p className="text-xs text-dark-400">{t.autoStartDesc}</p>
                </div>
                <button
                  onClick={async () => {
                    const newValue = !localSettings.autoStart;
                    setLocalSettings({ ...localSettings, autoStart: newValue });
                    await window.electronAPI?.setAutoStart(newValue);
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    localSettings.autoStart ? 'bg-primary-600' : 'bg-dark-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      localSettings.autoStart ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Хоткей скриншота */}
              <div className="flex items-center justify-between mt-2">
                <label className="text-sm font-medium text-white">{t.screenshotHotkey || 'Скриншот (Хоткей)'}</label>
                <input
                  type="text"
                  value={localSettings.screenshotHotkey || 'F11'}
                  onChange={(e) => setLocalSettings({ ...localSettings, screenshotHotkey: e.target.value.toUpperCase() })}
                  maxLength={5}
                  className="w-16 px-2 py-1 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-center text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Управление данными */}
          <div className="pt-4 border-t border-dark-700">
            <label className="block text-sm font-medium mb-2 text-white">{t.data}</label>
            <div className="space-y-2">
              <button
                onClick={handleClearHistory}
                className="w-full py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors text-sm text-left px-4 text-white"
              >
                {t.clearHistory}
              </button>
              <button
                onClick={handleExportFavorites}
                className="w-full py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors text-sm text-left px-4 text-white"
              >
                {t.exportFavorites}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium text-white"
          >
            {t.save}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors font-medium text-white"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
