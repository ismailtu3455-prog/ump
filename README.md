# Universal Media Player

Современный desktop-медиаплеер на **Electron + React + Tailwind** с единым плеером для **видео / аудио / изображений**, системой плейлистов, кастомными горячими клавишами и современным UI.

## Возможности

### Единый плеер
- Воспроизведение видео, аудио и изображений в одном интерфейсе.
- Скорость воспроизведения: `0.5x / 0.75x / 1x / 1.25x / 1.5x / 2x`.
- Режимы повтора: `none / all / one / random`.
- Полноэкранный режим.
- Picture-in-Picture (если поддерживается).
- Скриншот текущего кадра видео.
- Управление громкостью, mute, seek.

### Плейлисты
- Создание / переименование / удаление пользовательских плейлистов.
- Системный плейлист `recent`.
- Добавление файлов через диалог, папку и drag&drop.
- Drag&drop медиа между плейлистами.
- Избранное (лайк) с быстрым перемещением файла вверх.
- Поиск по файлам внутри активного плейлиста.

### Сохранение на диск
- Ручное сохранение плейлиста в локальную папку.
- Автоматическая загрузка сохраненных плейлистов при старте.
- Прогресс копирования файлов (с возможностью скрыть/показать).
- Переключатель **Автосохранение** (auto-save при добавлении локальных файлов).

### Интерфейс и UX
- Кастомное окно приложения (без системной шапки).
- Glassmorphism-стиль, мягкие тени, анимации появления.
- Tooltip при долгом наведении на иконки.
- Splash-экран с анимированным логотипом.
- Уведомления с авто-скрытием и анти-спам дедупликацией.

### Настройки
- Тема: `Dark / Light`.
- Язык: `RU / EN`.
- Accent color.
- Прозрачность панелей.
- Режим в трее.
- Автозапуск приложения.
- Задержка между треками (в секундах).
- Отдельная вкладка кастомных горячих клавиш.

---

## Поддерживаемые форматы

- **Видео:** `mp4`, `webm`, `mkv`, `avi`, `mov`, `ogg`
- **Аудио:** `mp3`, `wav`, `flac`, `m4a`
- **Изображения:** `jpg`, `jpeg`, `png`, `webp`, `gif`, `bmp`

---

## Технологии

- **Frontend:** React 18, TypeScript, Redux Toolkit
- **Desktop:** Electron
- **UI:** Tailwind CSS
- **Build:** Vite, electron-builder

---

## Быстрый старт

### Требования
- Node.js 18+
- npm 9+

### Установка зависимостей
```bash
npm install
```

### Режим разработки
```bash
npm run electron:dev
```

### Production build (frontend)
```bash
npm run build
```

### Сборка Windows `.exe`
```bash
npm run electron:build
```

После сборки установщик находится в:
- `dist-app/Universal Media Player Setup 4.0.0.exe`

---

## Скрипты

- `npm run dev` — запуск Vite
- `npm run electron:dev` — Electron + Vite в dev
- `npm run build` — сборка frontend
- `npm run electron:build` — сборка installer через electron-builder
- `npm run type-check` — проверка TypeScript типов
- `npm run lint` — ESLint

---

## Горячие клавиши по умолчанию

- `Space` — Play/Pause
- `P` — Previous
- `N` — Next
- `R` — Repeat mode
- `ArrowLeft` — Seek -5s
- `ArrowRight` — Seek +5s
- `ArrowUp` — Volume +
- `ArrowDown` — Volume -
- `Ctrl+ArrowUp` — Speed +
- `Ctrl+ArrowDown` — Speed -
- `Ctrl+0` — Speed 1x
- `M` — Mute
- `F` — Fullscreen
- `Ctrl+O` — Open files

Все бинды можно изменить в настройках (вкладка `Hotkeys`).

---

## Структура проекта

```text
UMPlayer/
├── public/
│   ├── main.js            # Electron main process
│   └── preload.js         # Context bridge API
├── src/
│   ├── components/        # UI компоненты
│   ├── store/             # Redux slices/store
│   ├── hooks/             # React hooks
│   ├── utils/             # Утилиты
│   └── types/             # TypeScript типы
├── features.txt           # Полный список функций
├── update.txt             # История изменений
└── package.json
```

---

## Важно

- Старые функции YouTube / webview / legacy-mode удалены из актуальной версии.
- Если файл был добавлен в старой сборке как `blob:` путь, добавьте его заново для корректного сохранения на диск.

---

## Лицензия

MIT
