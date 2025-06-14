'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import CreateExchangeUser from './CreateExchangeUser';
import BankManagement from './BankManagement';

export default function AdminDashboard() {
  const router = useRouter();
  const [showCreateExchange, setShowCreateExchange] = useState(false);
  const [showBankManagement, setShowBankManagement] = useState(false);

  // Placeholder statistics
  const stats = [
    { name: 'Total Orders', value: '0', icon: '📋', color: 'bg-blue-500' },
    { name: 'Pending Orders', value: '0', icon: '⏳', color: 'bg-yellow-500' },
    { name: 'Active Exchanges', value: '1', icon: '🏪', color: 'bg-green-500' },
    { name: 'Total Balance', value: 'JOD 1,000', icon: '💰', color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome message */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to Admin Dashboard
        </h1>
        <p className="text-gray-600">
          Manage exchange offices, monitor orders, and oversee financial transfers.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div 
            key={stat.name} 
            onClick={() => (stat.name === 'Total Orders' || stat.name === 'Pending Orders') ? router.push('/admin/orders') : undefined}
            className={`bg-white rounded-lg shadow p-4 ${(stat.name === 'Total Orders' || stat.name === 'Pending Orders') ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
          >
            <div className="flex items-center">
              <div className={`p-2 rounded-full ${stat.color} text-white text-lg`}>
                {stat.icon}
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600">{stat.name}</p>
                <p className="text-lg font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button 
            onClick={() => router.push('/admin/orders')}
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <div className="text-center">
              <div className="text-2xl mb-2">📋</div>
              <div className="text-sm font-medium text-gray-700">Manage Orders</div>
              <div className="text-xs text-gray-500">Order workflow & monitoring</div>
            </div>
          </button>
          
          <button 
            onClick={() => setShowCreateExchange(true)}
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors"
          >
            <div className="text-center">
              <div className="text-2xl mb-2">🏪</div>
              <div className="text-sm font-medium text-gray-700">Create Exchange</div>
              <div className="text-xs text-gray-500">Add new exchange office</div>
            </div>
          </button>
          
          <button 
            onClick={() => setShowBankManagement(true)}
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-colors"
          >
            <div className="text-center">
              <div className="text-2xl mb-2">🏦</div>
              <div className="text-sm font-medium text-gray-700">Manage Banks</div>
              <div className="text-xs text-gray-500">Configure platform banks</div>
            </div>
          </button>
          
          <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors">
            <div className="text-center">
              <div className="text-2xl mb-2">📊</div>
              <div className="text-sm font-medium text-gray-700">View Reports</div>
              <div className="text-xs text-gray-500">Financial reports</div>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recent activity</h3>
          <p className="text-gray-500">
            Activity will appear here once exchanges start submitting orders.
          </p>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
            <span className="text-sm text-gray-600">System Online</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
            <span className="text-sm text-gray-600">Database Connected</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
            <span className="text-sm text-gray-600">Firebase Storage Ready</span>
          </div>
        </div>
      </div>

      {/* Create Exchange User Modal */}
      {showCreateExchange && (
        <CreateExchangeUser 
          onUserCreated={() => {
            setShowCreateExchange(false);
            window.location.reload();
          }}
          onClose={() => setShowCreateExchange(false)}
        />
      )}

      {/* Bank Management Modal */}
      {showBankManagement && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 mx-auto p-5 border w-full max-w-7xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Bank Management System</h3>
              <button
                onClick={() => setShowBankManagement(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            <BankManagement />
          </div>
        </div>
      )}
    </div>
  );
} 