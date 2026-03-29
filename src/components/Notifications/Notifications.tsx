import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import { removeNotification } from '@store/uiSlice';

const notificationStyle: Record<string, string> = {
  success: 'border-emerald-300/30 bg-emerald-500/15 text-emerald-100',
  error: 'border-rose-300/30 bg-rose-500/15 text-rose-100',
  warning: 'border-amber-300/30 bg-amber-500/15 text-amber-100',
  info: 'border-sky-300/30 bg-sky-500/15 text-sky-100',
};

function Notifications() {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector((state) => state.ui.notifications);

  useEffect(() => {
    if (notifications.length === 0) return;

    const timers = notifications.map((notification) => {
      return window.setTimeout(() => {
        dispatch(removeNotification(notification.id));
      }, 2200);
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dispatch, notifications]);

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[80] flex w-[340px] flex-col gap-3">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`pointer-events-auto animate-notification rounded-2xl border px-4 py-3 shadow-soft backdrop-blur-lg ${notificationStyle[notification.type] || notificationStyle.info}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{notification.title}</p>
              <p className="mt-1 text-xs opacity-90">{notification.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dispatch(removeNotification(notification.id))}
              className="rounded-lg px-2 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              x
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Notifications;

