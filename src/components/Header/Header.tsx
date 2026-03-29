import { useMemo } from 'react';
import { useAppSelector } from '@hooks/useRedux';
import { translations } from '@utils/translations';

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
}

const LINKS = {
  github: 'https://github.com/ismailtu3455-prog/ump',
  telegram: 'https://t.me/ump_player',
  donate: 'https://boosty.to/ump',
};

function Header({ onToggleSidebar, onOpenSettings }: HeaderProps) {
  const currentFile = useAppSelector((state) => state.player.currentFile);
  const isSidebarOpen = useAppSelector((state) => state.ui.isSidebarOpen);
  const language = useAppSelector((state) => state.ui.language);
  const t = translations[language];

  const fileLabel = useMemo(() => {
    if (!currentFile) return t.noMediaHint;
    return `${currentFile.name} - ${currentFile.format.toUpperCase()}`;
  }, [currentFile, t.noMediaHint]);

  const openExternal = (url: string) => {
    if (window.electronAPI?.openUrl) {
      window.electronAPI.openUrl(url).catch(() => undefined);
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <header className="glass-panel header-enter drag-region relative z-30 mx-[6px] mt-[6px] flex h-[48px] items-center justify-between overflow-hidden rounded-xl px-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="tooltip-trigger interactive-btn no-drag rounded-xl px-2.5 py-2 text-white/90"
          data-tooltip={isSidebarOpen ? t.hideSidebar : t.showSidebar}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
          </svg>
        </button>

        <div className="logo-badge">
          <span>UM</span>
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{t.appName}</p>
          <p className="truncate text-xs text-white/60">{fileLabel}</p>
        </div>
      </div>

      <div className="no-drag ml-2 flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => openExternal(LINKS.telegram)}
          className="tooltip-trigger interactive-btn rounded-lg px-2.5 py-1.5 text-white/85"
          data-tooltip={t.telegram}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="m21.4 4.5-3 14.4c-.2 1-1 1.2-1.8.8l-4.6-3.4-2.2 2.1c-.2.2-.4.4-.8.4l.3-4.8 8.8-8c.4-.4-.1-.6-.6-.2L6.5 12.5l-4.6-1.5c-1-.3-1-1 .2-1.4L20 2.8c.9-.3 1.7.2 1.4 1.7Z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => openExternal(LINKS.donate)}
          className="tooltip-trigger interactive-btn rounded-lg px-2.5 py-1.5 text-white/85"
          data-tooltip={t.donate}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => openExternal(LINKS.github)}
          className="tooltip-trigger interactive-btn rounded-lg px-2.5 py-1.5 text-white/85"
          data-tooltip={t.github}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2c-3.3.7-4-1.4-4-1.4-.6-1.5-1.3-1.8-1.3-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.3 1.9 1.3 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.7-2.7-.3-5.6-1.3-5.6-6A4.7 4.7 0 0 1 6.7 7c-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11 11 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1a4.7 4.7 0 0 1 1.2 3.3c0 4.7-2.9 5.7-5.6 6 .4.3.8 1 .8 2.1v3.1c0 .4.2.7.8.6A11.5 11.5 0 0 0 12 .5Z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="tooltip-trigger interactive-btn rounded-lg px-2.5 py-1.5 text-white/90"
          data-tooltip={t.openSettings}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path
              d="M10.3 3.4a1 1 0 0 1 1.4 0l1.1 1.1a1 1 0 0 0 1 .24l1.5-.5a1 1 0 0 1 1.2.6l.6 1.4a1 1 0 0 0 .8.6l1.5.2a1 1 0 0 1 .9 1v1.6a1 1 0 0 0 .5.9l1.3.8a1 1 0 0 1 .3 1.3l-.8 1.3a1 1 0 0 0-.1 1l.6 1.4a1 1 0 0 1-.5 1.3l-1.4.6a1 1 0 0 0-.6.8l-.2 1.5a1 1 0 0 1-1 .9h-1.6a1 1 0 0 0-.9.5l-.8 1.3a1 1 0 0 1-1.3.3l-1.3-.8a1 1 0 0 0-1-.1l-1.4.6a1 1 0 0 1-1.3-.5l-.6-1.4a1 1 0 0 0-.8-.6l-1.5-.2a1 1 0 0 1-.9-1v-1.6a1 1 0 0 0-.5-.9l-1.3-.8a1 1 0 0 1-.3-1.3l.8-1.3a1 1 0 0 0 .1-1L2.9 11a1 1 0 0 1 .5-1.3l1.4-.6a1 1 0 0 0 .6-.8l.2-1.5a1 1 0 0 1 1-.9h1.6a1 1 0 0 0 .9-.5l.8-1.3Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3.1" />
          </svg>
        </button>

        <div className="mx-1 h-5 w-px bg-white/15" />

        <button
          type="button"
          onClick={() => window.electronAPI?.minimizeWindow()}
          className="tooltip-trigger interactive-btn rounded-lg px-2 py-1.5 text-white/80"
          data-tooltip={t.minimize}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => window.electronAPI?.maximizeWindow()}
          className="tooltip-trigger interactive-btn rounded-lg px-2 py-1.5 text-white/80"
          data-tooltip={t.maximize}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="5" width="14" height="14" rx="1.5" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => window.electronAPI?.closeWindow()}
          className="tooltip-trigger rounded-lg bg-rose-500/20 px-2 py-1.5 text-rose-100 transition hover:bg-rose-500/35"
          data-tooltip={t.closeWindow}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m7 7 10 10M17 7 7 17" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}

export default Header;
