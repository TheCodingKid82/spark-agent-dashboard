'use client';

import { useState, useEffect } from 'react';
import { 
  Bell, 
  Check,
  AtSign,
  UserPlus,
  MessageCircle,
  ArrowRight,
  X
} from 'lucide-react';
import { AgentIcon } from '@/lib/icons';

interface Notification {
  id: string;
  recipient_id: string;
  sender_id?: string;
  type: 'mention' | 'assignment' | 'comment' | 'status_change' | 'system';
  title: string;
  message: string;
  target_type: string;
  target_id: string;
  read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  recipientId?: string;
}

const TYPE_ICONS = {
  mention: <AtSign className="w-4 h-4 text-pink-400" />,
  assignment: <UserPlus className="w-4 h-4 text-cyan-400" />,
  comment: <MessageCircle className="w-4 h-4 text-purple-400" />,
  status_change: <ArrowRight className="w-4 h-4 text-orange-400" />,
  system: <Bell className="w-4 h-4 text-zinc-400" />,
};

export function NotificationBell({ recipientId = 'all' }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications?recipientId=${recipientId}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [recipientId]);

  const markAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: recipientId }),
      });
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-zinc-800 transition-colors"
      >
        <Bell className="w-5 h-5 text-zinc-400" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="font-semibold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No notifications</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 p-3 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-zinc-800/20' : ''
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="mt-0.5">
                      {TYPE_ICONS[notification.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 font-medium">
                        {notification.title}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {notification.sender_id && (
                          <AgentIcon agentId={notification.sender_id} size={14} />
                        )}
                        <span className="text-xs text-zinc-600">
                          {formatTime(notification.created_at)}
                        </span>
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-400 rounded-full mt-1.5" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default NotificationBell;
