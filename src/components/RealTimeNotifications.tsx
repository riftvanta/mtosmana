'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Notification,
  NotificationType,
  ConnectionStatus,
  Order,
  User
} from '@/types';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface RealTimeNotificationsProps {
  onNotificationClick?: (notification: Notification) => void;
  maxVisible?: number;
  enableSounds?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}

interface ToastNotification extends Notification {
  isVisible: boolean;
  timeoutId?: NodeJS.Timeout;
}

const RealTimeNotifications: React.FC<RealTimeNotificationsProps> = ({
  onNotificationClick,
  maxVisible = 5,
  enableSounds = true,
  position = 'top-right',
  className = ''
}) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toastNotifications, setToastNotifications] = useState<ToastNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: true,
    isReconnecting: false,
    connectionQuality: 'excellent'
  });
  const [loading, setLoading] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize audio for notifications
  useEffect(() => {
    if (enableSounds && typeof window !== 'undefined') {
      audioRef.current = new Audio('/notification-sound.mp3'); // You'd need to add this file
      audioRef.current.volume = 0.5;
    }
  }, [enableSounds]);

  // Set up real-time notification listener
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.id),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        setConnectionStatus(prev => ({
          ...prev,
          isConnected: true,
          isReconnecting: false,
          connectionQuality: 'excellent',
          lastConnectedAt: new Date()
        }));

        const notificationsData: Notification[] = [];
        
        snapshot.docChanges().forEach((change) => {
          const notification = {
            id: change.doc.id,
            ...change.doc.data()
          } as Notification;

          if (change.type === 'added') {
            notificationsData.push(notification);
            
            // Show toast for new notifications
            if (!notification.isRead) {
              showToastNotification(notification);
              playNotificationSound();
            }
          }
        });

        // Update all notifications
        const allNotifications = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Notification[];

        setNotifications(allNotifications);
        setUnreadCount(allNotifications.filter(n => !n.isRead).length);
      },
      (error) => {
        console.error('Error listening to notifications:', error);
        setConnectionStatus(prev => ({
          ...prev,
          isConnected: false,
          isReconnecting: true,
          connectionQuality: 'offline'
        }));
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [user]);

  // Connection monitoring
  useEffect(() => {
    const handleOnline = () => {
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: true,
        isReconnecting: false,
        connectionQuality: 'excellent'
      }));
    };

    const handleOffline = () => {
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: false,
        connectionQuality: 'offline'
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    if (enableSounds && audioRef.current) {
      audioRef.current.play().catch(error => {
        console.log('Could not play notification sound:', error);
      });
    }
  }, [enableSounds]);

  const showToastNotification = useCallback((notification: Notification) => {
    const toastId = `toast-${notification.id}-${Date.now()}`;
    const toast: ToastNotification = {
      ...notification,
      id: toastId,
      isVisible: true
    };

    setToastNotifications(prev => {
      const newToasts = [toast, ...prev].slice(0, maxVisible);
      return newToasts;
    });

    // Auto-hide toast after 5 seconds
    const timeoutId = setTimeout(() => {
      hideToastNotification(toastId);
    }, 5000);

    toast.timeoutId = timeoutId;
  }, [maxVisible]);

  const hideToastNotification = useCallback((toastId: string) => {
    setToastNotifications(prev => {
      const toast = prev.find(t => t.id === toastId);
      if (toast?.timeoutId) {
        clearTimeout(toast.timeoutId);
      }
      return prev.map(t => 
        t.id === toastId ? { ...t, isVisible: false } : t
      );
    });

    // Remove from array after animation
    setTimeout(() => {
      setToastNotifications(prev => prev.filter(t => t.id !== toastId));
    }, 300);
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        isRead: true,
        readAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    setLoading(true);
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead);
      const updatePromises = unreadNotifications.map(notification => 
        updateDoc(doc(db, 'notifications', notification.id), {
          isRead: true,
          readAt: serverTimestamp()
        })
      );
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    onNotificationClick?.(notification);
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'order_created':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        );
      case 'order_approved':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'order_rejected':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'order_completed':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'system_alert':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 15c-.77.833.19 2.5 1.732 2.5z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'critical': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'normal': return 'border-l-blue-500 bg-blue-50';
      case 'low': return 'border-l-gray-500 bg-gray-50';
      default: return 'border-l-blue-500 bg-blue-50';
    }
  };

  const getPositionClass = () => {
    switch (position) {
      case 'top-left': return 'top-4 left-4';
      case 'top-right': return 'top-4 right-4';
      case 'bottom-left': return 'bottom-4 left-4';
      case 'bottom-right': return 'bottom-4 right-4';
      default: return 'top-4 right-4';
    }
  };

  return (
    <div className={className}>
      {/* Notification Bell Icon */}
      <div className="relative">
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5-5V9.09c0-2.18-1.79-3.96-4-3.96S7 6.91 7 9.09V12l-5 5h5m2 0v1a2 2 0 01-2 2h-2a2 2 0 01-2-2v-1" />
          </svg>
          
          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full min-w-[1.25rem]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}

          {/* Connection Status Indicator */}
          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
            connectionStatus.isConnected 
              ? connectionStatus.connectionQuality === 'excellent' ? 'bg-green-500' : 'bg-yellow-500'
              : connectionStatus.isReconnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
          }`} />
        </button>

        {/* Notification Panel */}
        {showPanel && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
            {/* Panel Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    disabled={loading}
                    className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowPanel(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Connection Status */}
            {!connectionStatus.isConnected && (
              <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200">
                <div className="flex items-center text-sm text-yellow-800">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 15c-.77.833.19 2.5 1.732 2.5z" />
                  </svg>
                  {connectionStatus.isReconnecting ? 'Reconnecting...' : 'Connection lost'}
                </div>
              </div>
            )}

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5-5V9.09c0-2.18-1.79-3.96-4-3.96S7 6.91 7 9.09V12l-5 5h5m2 0v1a2 2 0 01-2 2h-2a2 2 0 01-2-2v-1" />
                  </svg>
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                      !notification.isRead ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0 mr-3 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium text-gray-900 ${!notification.isRead ? 'font-semibold' : ''}`}>
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-2" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                        {notification.actionText && (
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {notification.actionText}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      <div className={`fixed ${getPositionClass()} z-50 space-y-2 pointer-events-none`}>
        {toastNotifications.map((toast) => (
          <div
            key={toast.id}
            className={`transform transition-all duration-300 ease-in-out pointer-events-auto ${
              toast.isVisible 
                ? 'translate-x-0 opacity-100 scale-100' 
                : position.includes('right') 
                  ? 'translate-x-full opacity-0 scale-95'
                  : '-translate-x-full opacity-0 scale-95'
            }`}
          >
            <div className={`max-w-sm w-full bg-white shadow-lg rounded-lg border-l-4 ${getPriorityColor(toast.priority)}`}>
              <div className="p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {getNotificationIcon(toast.type)}
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {toast.title}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                      {toast.message}
                    </p>
                    {toast.actionText && (
                      <div className="mt-2">
                        <button
                          onClick={() => handleNotificationClick(toast)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-500"
                        >
                          {toast.actionText}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0 flex">
                    <button
                      onClick={() => hideToastNotification(toast.id)}
                      className="rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Click outside to close panel */}
      {showPanel && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowPanel(false)}
        />
      )}
    </div>
  );
};

export default RealTimeNotifications; 