import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@hooks/useRedux';
import { removeNotification } from '@store/uiSlice';

function Notifications() {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(state => state.ui.notifications);

  useEffect(() => {
    // Автоудаление через 5 секунд
    notifications.forEach(notif => {
      const timer = setTimeout(() => {
        dispatch(removeNotification(notif.id));
      }, 5000);
      return () => clearTimeout(timer);
    });
  }, [notifications, dispatch]);

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-600 border-green-500';
      case 'error':
        return 'bg-red-600 border-red-500';
      case 'warning':
        return 'bg-yellow-600 border-yellow-500';
      default:
        return 'bg-dark-700 border-dark-600';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
        );
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map(notif => (
        <div
          key={notif.id}
          className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg min-w-[300px] max-w-md animate-slide-in ${getNotificationStyles(notif.type)}`}
        >
          <div className="flex-shrink-0">{getNotificationIcon(notif.type)}</div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white text-sm">{notif.title}</p>
            <p className="text-xs text-white/80 mt-1">{notif.message}</p>
          </div>
          <button
            onClick={() => dispatch(removeNotification(notif.id))}
            className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export default Notifications;
