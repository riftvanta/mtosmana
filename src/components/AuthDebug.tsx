'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthDebug() {
  const { user, loading } = useAuth();
  const [showDebug, setShowDebug] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<string>('checking');

  useEffect(() => {
    // Check Firebase connection status
    const checkFirebase = async () => {
      try {
        const response = await fetch('https://firestore.googleapis.com/v1/projects/mtosmana/databases/(default)/documents/test');
        if (response.ok || response.status === 404) {
          setFirebaseStatus('connected');
        } else {
          setFirebaseStatus('permission-denied');
        }
      } catch {
        setFirebaseStatus('connection-error');
      }
    };

    checkFirebase();
  }, []);

  const clearAuth = () => {
    localStorage.removeItem('auth_user');
    window.location.reload();
  };

  const getFirebaseStatusColor = () => {
    switch (firebaseStatus) {
      case 'connected': return 'text-green-600';
      case 'permission-denied': return 'text-red-600';
      case 'connection-error': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  const getFirebaseStatusText = () => {
    switch (firebaseStatus) {
      case 'connected': return 'Firebase Connected';
      case 'permission-denied': return 'Firebase Permission Denied (Security Rules)';
      case 'connection-error': return 'Firebase Connection Error';
      default: return 'Checking Firebase...';
    }
  };

  if (!showDebug) {
    return (
      <button
        onClick={() => setShowDebug(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm opacity-50 hover:opacity-100 transition-opacity"
      >
        Debug Info
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm z-50">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-900">Debug Info</h3>
        <button
          onClick={() => setShowDebug(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium">Auth Status:</span>
          <span className={`ml-2 ${loading ? 'text-yellow-600' : user ? 'text-green-600' : 'text-red-600'}`}>
            {loading ? 'Loading...' : user ? 'Authenticated' : 'Not Authenticated'}
          </span>
        </div>

        {user && (
          <>
            <div>
              <span className="font-medium">User:</span>
              <span className="ml-2 text-gray-700">{user.username}</span>
            </div>
            <div>
              <span className="font-medium">Role:</span>
              <span className="ml-2 text-gray-700 capitalize">{user.role}</span>
            </div>
            {user.exchangeName && (
              <div>
                <span className="font-medium">Exchange:</span>
                <span className="ml-2 text-gray-700">{user.exchangeName}</span>
              </div>
            )}
          </>
        )}

        <div>
          <span className="font-medium">Firebase:</span>
          <span className={`ml-2 ${getFirebaseStatusColor()}`}>
            {getFirebaseStatusText()}
          </span>
        </div>

        <div>
          <span className="font-medium">LocalStorage:</span>
          <span className="ml-2 text-gray-700">
            {localStorage.getItem('auth_user') ? 'Has stored user' : 'Empty'}
          </span>
        </div>

        <div className="pt-2 space-y-2">
          <button
            onClick={clearAuth}
            className="w-full bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
          >
            Clear Auth & Reload
          </button>
          
          {firebaseStatus === 'permission-denied' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
              <p className="text-xs text-yellow-800">
                <strong>Fix:</strong> Deploy Firebase security rules from <code>firestore.rules</code>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 