'use client';

import React from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import AdminDashboard from '@/components/AdminDashboard';
import ExchangeDashboard from '@/components/ExchangeDashboard';

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Redirect will be handled by useRequireAuth
  }

  const getDashboardTitle = () => {
    if (user.role === 'admin') {
      return 'Admin Dashboard';
    } else {
      return user.exchangeName ? `${user.exchangeName} Dashboard` : 'Exchange Dashboard';
    }
  };

  const getDashboardComponent = () => {
    if (user.role === 'admin') {
      return <AdminDashboard />;
    } else {
      return <ExchangeDashboard />;
    }
  };

  return (
    <DashboardLayout title={getDashboardTitle()}>
      {getDashboardComponent()}
    </DashboardLayout>
  );
} 