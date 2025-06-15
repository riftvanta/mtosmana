'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface OrderMessage {
  id: string;
  orderId: string;
  senderId: string;
  senderRole: 'admin' | 'exchange';
  senderName: string;
  message: string;
  timestamp: Date;
  isSystemMessage?: boolean;
}

interface OrderChatProps {
  orderId: string;
  className?: string;
}

// Type for handling various timestamp formats
type TimestampType = Date | Timestamp | string | number | null | undefined;

const OrderChat: React.FC<OrderChatProps> = ({
  orderId,
  className = ''
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time message listener
  useEffect(() => {
    if (!orderId) return;

    const q = query(
      collection(db, 'orderMessages'),
      where('orderId', '==', orderId),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageData: OrderMessage[] = [];
      
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        
        // Properly convert Firebase Timestamp to JavaScript Date
        let convertedTimestamp: Date;
        if (data.timestamp && typeof data.timestamp === 'object' && 'toDate' in data.timestamp && typeof data.timestamp.toDate === 'function') {
          convertedTimestamp = data.timestamp.toDate();
        } else if (data.timestamp instanceof Date) {
          convertedTimestamp = data.timestamp;
        } else if (data.timestamp) {
          convertedTimestamp = new Date(data.timestamp);
        } else {
          convertedTimestamp = new Date();
        }

        const message = {
          id: change.doc.id,
          ...data,
          timestamp: convertedTimestamp
        } as OrderMessage;

        if (change.type === 'added') {
          messageData.push(message);
        }
      });

      if (messageData.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMessages = messageData.filter(m => !existingIds.has(m.id));
          return [...prev, ...newMessages].sort((a, b) => {
            const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
            const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
            return aTime - bTime;
          });
        });
      }

      setLoading(false);
    }, (error) => {
      console.error('Error loading messages:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orderId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || sending) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'orderMessages'), {
        orderId,
        senderId: user.id,
        senderRole: user.role,
        senderName: user.role === 'admin' ? 'Admin' : user.exchangeName || 'Exchange',
        message: newMessage.trim(),
        timestamp: serverTimestamp(),
        isSystemMessage: false
      });
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (timestamp: TimestampType): string => {
    try {
      let date: Date;
      
      // Handle Firebase Timestamp objects
      if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } 
      // Handle JavaScript Date objects
      else if (timestamp instanceof Date) {
        date = timestamp;
      } 
      // Handle timestamp strings or numbers
      else if (timestamp && (typeof timestamp === 'string' || typeof timestamp === 'number')) {
        date = new Date(timestamp);
      } 
      // Fallback for null/undefined
      else {
        return 'Just now';
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Just now';
      }

      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      // Show "Just now" for messages less than 1 minute old
      if (diffInMinutes < 1) {
        return 'Just now';
      }
      
      // Show "X minutes ago" for messages less than 60 minutes old
      if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
      }
      
      const isToday = date.toDateString() === now.toDateString();
      
      if (isToday) {
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      } else {
        // For older messages, show date and time
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Unknown time';
    }
  };

  const isOwnMessage = (message: OrderMessage): boolean => {
    return user?.id === message.senderId;
  };

  if (!user) {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
        <p className="text-gray-500 text-center">Please log in to view messages</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow border ${className}`}>
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Order Chat</h3>
          <div className="flex items-center text-sm text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            Order {orderId}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="p-4 h-64 md:h-80 overflow-y-auto space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-500">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-gray-500 text-sm">No messages yet</p>
              <p className="text-gray-400 text-xs">Start a conversation about this order</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${isOwnMessage(message) ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                    message.isSystemMessage
                      ? 'bg-gray-100 text-gray-600 text-center text-sm mx-auto'
                      : isOwnMessage(message)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {!message.isSystemMessage && !isOwnMessage(message) && (
                    <div className="text-xs font-medium text-gray-600 mb-1">
                      {message.senderName}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {message.message}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      message.isSystemMessage
                        ? 'text-gray-500'
                        : isOwnMessage(message)
                        ? 'text-blue-100'
                        : 'text-gray-500'
                    }`}
                  >
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <div className="flex-1">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Send a message about order ${orderId}...`}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default OrderChat; 