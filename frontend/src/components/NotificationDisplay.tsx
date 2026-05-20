import { Bell, X } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';

export function NotificationDisplay() {
  const { notifications, clearNotification } = useNotification();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 no-print w-80 max-w-[90vw]">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className="bg-white rounded-lg shadow-xl p-4 border-l-4 border-blue-500 animate-slide-in"
        >
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800">{notif.title}</p>
              <p className="text-sm text-gray-600">{notif.message}</p>
            </div>
            <button onClick={() => clearNotification(notif.id)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
