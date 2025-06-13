'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export default function HomePage() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Redirect authenticated users to dashboard
        window.location.href = '/dashboard';
      } else {
        // Redirect unauthenticated users to login
        window.location.href = '/login';
      }
    }
  }, [user, loading]);

  // Show loading state while checking authentication
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Financial Transfer System
        </h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
