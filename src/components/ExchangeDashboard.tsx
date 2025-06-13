'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { User } from '@/types';

export default function ExchangeDashboard() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Try to fetch from Firebase first
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', user.username));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          const data = doc.data();
          setUserData({
            id: doc.id,
            username: data.username,
            password: data.password,
            role: data.role,
            exchangeName: data.exchangeName,
            contactInfo: data.contactInfo,
            balance: data.balance || 0,
            commissionRates: data.commissionRates || { incoming: 0, outgoing: 0 },
            assignedBanks: data.assignedBanks || [],
            status: data.status || 'active',
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  // Placeholder statistics
  const stats = [
    { name: 'My Orders', value: '0', icon: '📋', color: 'bg-blue-500' },
    { name: 'Pending', value: '0', icon: '⏳', color: 'bg-yellow-500' },
    { name: 'Completed', value: '0', icon: '✅', color: 'bg-green-500' },
    { 
      name: 'Current Balance', 
      value: userData ? `JOD ${userData.balance.toLocaleString()}` : 'JOD 0', 
      icon: '💰', 
      color: 'bg-purple-500' 
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome message */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome, {userData?.exchangeName || user?.exchangeName || user?.username}!
        </h1>
        <p className="text-gray-600">
          Submit and manage your financial transfer orders from this dashboard.
        </p>
        {userData?.contactInfo?.email && (
          <p className="text-sm text-gray-500 mt-2">
            📧 {userData.contactInfo.email} • 📱 {userData.contactInfo?.phone}
          </p>
        )}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <div className="text-center">
              <div className="text-3xl mb-3">📤</div>
              <div className="text-lg font-medium text-gray-700 mb-1">Outgoing Transfer</div>
              <div className="text-sm text-gray-500">Send money via CliQ</div>
            </div>
          </button>
          
          <button className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors">
            <div className="text-center">
              <div className="text-3xl mb-3">📥</div>
              <div className="text-lg font-medium text-gray-700 mb-1">Incoming Transfer</div>
              <div className="text-sm text-gray-500">Receive money to bank account</div>
            </div>
          </button>
        </div>
      </div>

      {/* Account Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Exchange Name</h3>
            <p className="text-lg text-gray-900">{userData?.exchangeName || user?.exchangeName || 'Not set'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Username</h3>
            <p className="text-lg text-gray-900">{user?.username}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Commission Rates</h3>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                Incoming: {userData?.commissionRates?.incoming ? `JOD ${userData.commissionRates.incoming}` : 'Not configured'}
              </p>
              <p className="text-sm text-gray-600">
                Outgoing: {userData?.commissionRates?.outgoing ? `JOD ${userData.commissionRates.outgoing}` : 'Not configured'}
              </p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Assigned Banks</h3>
            <p className="text-sm text-gray-600">
              {userData?.assignedBanks?.length ? `${userData.assignedBanks.length} banks assigned` : 'No banks assigned yet'}
            </p>
          </div>
          {userData?.contactInfo && (
            <>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Contact Email</h3>
                <p className="text-sm text-gray-900">{userData.contactInfo.email || 'Not provided'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Phone Number</h3>
                <p className="text-sm text-gray-900">{userData.contactInfo.phone || 'Not provided'}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent Orders Placeholder */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h2>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">📄</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
          <p className="text-gray-500 mb-4">
            Start by creating your first transfer order.
          </p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
            Create New Order
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Connection Status</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
            <span className="text-sm text-gray-600">Connected to System</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
            <span className="text-sm text-gray-600">Real-time Updates Active</span>
          </div>
          <div className="flex items-center">
            <div className={`w-3 h-3 ${userData ? 'bg-green-400' : 'bg-yellow-400'} rounded-full mr-3`}></div>
            <span className="text-sm text-gray-600">
              {userData ? 'Firebase Data Loaded' : 'Using Demo Data'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
} 