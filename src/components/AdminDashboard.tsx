'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Order } from '@/types';
import CreateExchangeUser from './CreateExchangeUser';
import BankManagement from './BankManagement';

export default function AdminDashboard() {
  const router = useRouter();
  const [showCreateExchange, setShowCreateExchange] = useState(false);
  const [showBankManagement, setShowBankManagement] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [realTimeStats, setRealTimeStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    activeExchanges: 0,
    totalVolume: 0
  });

  useEffect(() => {
    loadDashboardData();
    setupRealTimeListeners();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get recent orders
      await loadRecentOrders();
      
      // Get real-time statistics
      await loadRealTimeStats();
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentOrders = async () => {
    try {
      const q = query(
        collection(db, 'orders'),
        orderBy('timestamps.created', 'desc'),
        limit(10)
      );
      
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      setRecentOrders(orders);
    } catch (error) {
      console.error('Error loading recent orders:', error);
      // Fallback to empty array
      setRecentOrders([]);
    }
  };

  const loadRealTimeStats = async () => {
    try {
      // Get total orders count
      const allOrdersQuery = query(collection(db, 'orders'));
      const allOrdersSnapshot = await getDocs(allOrdersQuery);
      const allOrders = allOrdersSnapshot.docs.map(doc => doc.data() as Order);
      
      // Get pending orders count
      const pendingOrders = allOrders.filter(order => 
        ['submitted', 'pending_review', 'approved'].includes(order.status)
      );
      
      // Get active exchanges count
      const activeExchangesQuery = query(
        collection(db, 'users'),
        where('role', '==', 'exchange'),
        where('status', '==', 'active')
      );
      const activeExchangesSnapshot = await getDocs(activeExchangesQuery);
      
      // Calculate total volume
      const totalVolume = allOrders.reduce((sum, order) => sum + order.submittedAmount, 0);
      
      setRealTimeStats({
        totalOrders: allOrders.length,
        pendingOrders: pendingOrders.length,
        activeExchanges: activeExchangesSnapshot.size,
        totalVolume
      });
    } catch (error) {
      console.error('Error loading real-time stats:', error);
    }
  };

  const setupRealTimeListeners = () => {
    // Listen for new orders
    const ordersQuery = query(
      collection(db, 'orders'),
      orderBy('timestamps.created', 'desc'),
      limit(10)
    );

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setRecentOrders(orders);
      
      // Update real-time stats when orders change
      loadRealTimeStats();
    }, (error) => {
      console.error('Orders listener error:', error);
    });

    // Cleanup listener on unmount
    return () => {
      unsubscribeOrders();
    };
  };

  const formatDate = (timestamp: Date | number | string | { toDate?: () => Date; seconds?: number } | null | undefined): string => {
    try {
      if (!timestamp) return 'Unknown date';
      
      let date: Date;
      
      if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else {
        return 'Unknown date';
      }
      
      if (isNaN(date.getTime())) {
        return 'Unknown date';
      }
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown date';
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'JOD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'pending_review': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string): string => {
    return type === 'incoming' ? '📥' : '📤';
  };

  // Dynamic statistics based on real data
  const stats = [
    { 
      name: 'Total Orders', 
      value: loading ? '...' : realTimeStats.totalOrders.toString(), 
      icon: '📋', 
      color: 'bg-blue-500',
      clickable: true
    },
    { 
      name: 'Pending Orders', 
      value: loading ? '...' : realTimeStats.pendingOrders.toString(), 
      icon: '⏳', 
      color: 'bg-yellow-500',
      clickable: true
    },
    { 
      name: 'Active Exchanges', 
      value: loading ? '...' : realTimeStats.activeExchanges.toString(), 
      icon: '🏪', 
      color: 'bg-green-500',
      clickable: false
    },
    { 
      name: 'Total Volume', 
      value: loading ? '...' : formatCurrency(realTimeStats.totalVolume), 
      icon: '💰', 
      color: 'bg-purple-500',
      clickable: false
    },
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
            onClick={() => stat.clickable ? router.push('/admin/orders') : undefined}
            className={`bg-white rounded-lg shadow p-4 ${stat.clickable ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
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

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <button 
            onClick={() => router.push('/admin/orders')}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View All Orders →
          </button>
        </div>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading recent activity...</p>
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📝</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recent activity</h3>
            <p className="text-gray-500">
              Activity will appear here once exchanges start submitting orders.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.slice(0, 5).map((order) => (
              <div 
                key={order.id} 
                className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => router.push(`/admin/orders?orderId=${order.orderId}`)}
              >
                <div className="text-2xl">
                  {getTypeIcon(order.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      Order #{order.orderId}
                    </p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 mt-1">
                    <p className="text-sm text-gray-500">
                      {formatCurrency(order.submittedAmount)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDate(order.timestamps.created)}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  →
                </div>
              </div>
            ))}
            
            {recentOrders.length > 5 && (
              <div className="text-center pt-2">
                <button 
                  onClick={() => router.push('/admin/orders')}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  View {recentOrders.length - 5} more orders
                </button>
              </div>
            )}
          </div>
        )}
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