'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { User, CommissionRate, Order, OrderStatistics } from '@/types';
import { getOrderStatistics } from '@/lib/orderOperations';

export default function ExchangeDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderStats, setOrderStats] = useState<OrderStatistics | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

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
          
          // Handle backward compatibility for commission rates
          let commissionRates: { incoming: CommissionRate; outgoing: CommissionRate };
          
          if (data.commissionRates) {
            // Check if it's the old format (numbers) or new format (objects)
            if (typeof data.commissionRates.incoming === 'number') {
              // Old format - convert to new format
              commissionRates = {
                incoming: { type: 'fixed', value: data.commissionRates.incoming },
                outgoing: { type: 'fixed', value: data.commissionRates.outgoing }
              };
            } else {
              // New format
              commissionRates = data.commissionRates;
            }
          } else {
            // Default values
            commissionRates = {
              incoming: { type: 'fixed', value: 0 },
              outgoing: { type: 'fixed', value: 0 }
            };
          }
          
          setUserData({
            id: doc.id,
            username: data.username,
            password: data.password,
            role: data.role,
            exchangeName: data.exchangeName,
            contactInfo: data.contactInfo,
            balance: data.balance || 0,
            commissionRates,
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

  // Fetch order statistics and recent orders
  useEffect(() => {
    const fetchOrderData = async () => {
      if (!user?.id) {
        setOrdersLoading(false);
        return;
      }

      try {
        setOrdersLoading(true);
        
        // Fetch order statistics
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90); // Last 90 days
        
        const stats = await getOrderStatistics(startDate, endDate, user.id);
        setOrderStats(stats);
        
        // Fetch recent orders
        const ordersRef = collection(db, 'orders');
        const recentOrdersQuery = query(
          ordersRef,
          where('exchangeId', '==', user.id),
          orderBy('timestamps.created', 'desc'),
          limit(5)
        );
        
        const recentOrdersSnapshot = await getDocs(recentOrdersQuery);
        const orders = recentOrdersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Order[];
        
        setRecentOrders(orders);
      } catch (error) {
        console.error('Error fetching order data:', error);
        // Set empty data on error
        setOrderStats({
          totalOrders: 0,
          ordersByStatus: {
            submitted: 0,
            pending_review: 0,
            approved: 0,
            rejected: 0,
            processing: 0,
            completed: 0,
            cancelled: 0,
            cancellation_requested: 0
          },
          ordersByType: {
            incoming: 0,
            outgoing: 0
          },
          totalVolume: 0,
          totalCommission: 0,
          averageOrderValue: 0,
          processingTime: { average: 0, median: 0, fastest: 0, slowest: 0 },
          period: { startDate: new Date(), endDate: new Date() }
        });
        setRecentOrders([]);
      } finally {
        setOrdersLoading(false);
      }
    };

    fetchOrderData();
  }, [user]);

  // Calculate statistics from order data
  const getStatistics = () => {
    if (!orderStats) {
      return [
        { name: 'My Orders', value: '0', icon: '📋', color: 'bg-blue-500' },
        { name: 'Pending', value: '0', icon: '⏳', color: 'bg-yellow-500' },
        { name: 'Completed', value: '0', icon: '✅', color: 'bg-green-500' },
      ];
    }

    const pendingCount = (orderStats.ordersByStatus.submitted || 0) + 
                        (orderStats.ordersByStatus.pending_review || 0) + 
                        (orderStats.ordersByStatus.approved || 0) + 
                        (orderStats.ordersByStatus.processing || 0);
    
    const completedCount = orderStats.ordersByStatus.completed || 0;

    return [
      { name: 'My Orders', value: orderStats.totalOrders.toString(), icon: '📋', color: 'bg-blue-500' },
      { name: 'Pending', value: pendingCount.toString(), icon: '⏳', color: 'bg-yellow-500' },
      { name: 'Completed', value: completedCount.toString(), icon: '✅', color: 'bg-green-500' },
    ];
  };

  const stats = getStatistics();

  // Balance data for custom card
  const balanceData = {
    amount: userData ? userData.balance : 0,
    formatted: userData ? userData.balance.toLocaleString() : '0'
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'pending_review': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      case 'cancellation_requested': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div 
            key={stat.name} 
            onClick={() => stat.name === 'My Orders' ? router.push('/orders') : undefined}
            className={`bg-white rounded-lg shadow p-6 ${stat.name === 'My Orders' ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
          >
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${stat.color} text-white text-xl`}>
                {stat.icon}
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {ordersLoading ? '...' : stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
        
        {/* Custom Balance Card - More elegant for mobile */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-500 text-white text-xl">
              💰
            </div>
            <div className="ml-4 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-600 whitespace-nowrap">
                Balance
              </p>
              <div className="flex items-baseline">
                <span className="text-2xl font-bold text-gray-900">
                  {balanceData.formatted}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={() => router.push('/orders/new?type=outgoing')}
            className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <div className="text-center">
              <div className="text-3xl mb-3">📤</div>
              <div className="text-lg font-medium text-gray-700 mb-1">Outgoing Transfer</div>
              <div className="text-sm text-gray-500">Send money via CliQ</div>
            </div>
          </button>
          
          <button 
            onClick={() => router.push('/orders/new?type=incoming')}
            className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors"
          >
            <div className="text-center">
              <div className="text-3xl mb-3">📥</div>
              <div className="text-lg font-medium text-gray-700 mb-1">Incoming Transfer</div>
              <div className="text-sm text-gray-500">Receive money to bank account</div>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
          <button
            onClick={() => router.push('/orders')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View All Orders
          </button>
        </div>
        
        {ordersLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading orders...</p>
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📄</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
            <p className="text-gray-500 mb-4">
              Start by creating your first transfer order.
            </p>
            <button 
              onClick={() => router.push('/orders/new')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Create New Order
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${order.type === 'incoming' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                  <div>
                    <div className="font-medium text-gray-900">{order.orderId}</div>
                    <div className="text-sm text-gray-500">
                      {order.type === 'incoming' ? 'Incoming' : 'Outgoing'} • {order.submittedAmount.toFixed(2)} JOD
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                  <div className="text-sm text-gray-500">
                    {(() => {
                      try {
                        // Handle different timestamp formats from Firestore
                        const timestamp = order.timestamps.created;
                        let date;
                        
                        if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
                          // Firestore Timestamp object
                          date = timestamp.toDate();
                        } else if (timestamp instanceof Date) {
                          // Already a Date object
                          date = timestamp;
                        } else if (typeof timestamp === 'number') {
                          // Unix timestamp
                          date = new Date(timestamp);
                        } else if (typeof timestamp === 'string') {
                          // ISO string
                          date = new Date(timestamp);
                        } else {
                          // Fallback
                          date = new Date();
                        }
                        
                        return date.toLocaleDateString();
                      } catch (error) {
                        console.error('Error formatting date:', error);
                        return 'Unknown date';
                      }
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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