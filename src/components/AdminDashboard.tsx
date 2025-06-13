'use client';

import React from 'react';
import CreateExchangeUser from './CreateExchangeUser';

export default function AdminDashboard() {
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${stat.color} text-white text-xl`}>
                {stat.icon}
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col">
            <CreateExchangeUser />
            <p className="text-xs text-gray-500 mt-2 text-center">Add new exchange office account</p>
          </div>
          
          <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors">
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

      {/* Exchange Management */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Exchange Management</h2>
          <CreateExchangeUser onUserCreated={() => window.location.reload()} />
        </div>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🏪</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Active Exchange: Al-Jordan Exchange</h3>
          <p className="text-gray-500 mb-4">
            Currently managing 1 active exchange office.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-md p-3 inline-block">
            <p className="text-sm text-green-800">
              <strong>Username:</strong> exchange1 • <strong>Balance:</strong> JOD 1,000
            </p>
          </div>
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
    </div>
  );
} 