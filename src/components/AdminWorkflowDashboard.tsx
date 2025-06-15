'use client';

import React, { useState, useEffect } from 'react';
import {
  Order,
  OrderStatus,
  ConnectionStatus
} from '@/types';

import {
  collection,
  query,
  limit,
  onSnapshot,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import OrderStatusWorkflow from './OrderStatusWorkflow';
import OrderChat from './OrderChat';
import RealTimeNotifications from './RealTimeNotifications';

interface AdminOrderDashboardProps {
  className?: string;
}

interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  completedToday: number;
  rejectedToday: number;
}

const AdminOrderDashboard: React.FC<AdminOrderDashboardProps> = ({
  className = ''
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);

  // Filters and search
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });

  // Data state
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [orderStats, setOrderStats] = useState<OrderStats>({
    totalOrders: 0,
    pendingOrders: 0,
    processingOrders: 0,
    completedToday: 0,
    rejectedToday: 0
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: true,
    isReconnecting: false,
    connectionQuality: 'excellent'
  });

  // Bulk selection
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');

  // Real-time data loading
  useEffect(() => {
    loadInitialData();
    setupRealTimeListeners();

    return () => {
      // Cleanup listeners
    };
  }, []);

  // Filter orders whenever orders or filters change
  useEffect(() => {
    filterOrders();
  }, [orders, statusFilter, typeFilter, searchTerm, dateRange]);

  // Calculate stats whenever orders change
  useEffect(() => {
    calculateOrderStats();
  }, [orders]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await loadOrders();
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('Failed to load order data');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      // Load all orders with simple query to avoid index requirements
      const q = query(
        collection(db, 'orders'),
        limit(200)
      );
      const snapshot = await getDocs(q);
      const allOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      // Sort by creation date (most recent first)
      allOrders.sort((a, b) => {
        const aTime = a.timestamps.created instanceof Date ? a.timestamps.created.getTime() : new Date(a.timestamps.created).getTime();
        const bTime = b.timestamps.created instanceof Date ? b.timestamps.created.getTime() : new Date(b.timestamps.created).getTime();
        return bTime - aTime;
      });
      
      setOrders(allOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    }
  };

  const setupRealTimeListeners = () => {
    // Listen for order changes with simple query
    const ordersQuery = query(
      collection(db, 'orders'),
      limit(200)
    );

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const allOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      // Sort by creation date (most recent first)
      allOrders.sort((a, b) => {
        const aTime = a.timestamps.created instanceof Date ? a.timestamps.created.getTime() : new Date(a.timestamps.created).getTime();
        const bTime = b.timestamps.created instanceof Date ? b.timestamps.created.getTime() : new Date(b.timestamps.created).getTime();
        return bTime - aTime;
      });
      
      setOrders(allOrders);
      setConnectionStatus(prev => ({ ...prev, isConnected: true }));
    }, (error) => {
      console.error('Orders listener error:', error);
      setConnectionStatus(prev => ({ ...prev, isConnected: false }));
    });

    return () => {
      unsubscribeOrders();
    };
  };

  const filterOrders = () => {
    let filtered = [...orders];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(order => order.type === typeFilter);
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        order.orderId?.toLowerCase().includes(searchLower) ||
        order.submittedAmount.toString().includes(searchLower) ||
        order.recipientDetails?.name?.toLowerCase().includes(searchLower) ||
        order.cliqDetails?.aliasName?.toLowerCase().includes(searchLower) ||
        order.cliqDetails?.mobileNumber?.includes(searchTerm)
      );
    }

    // Date range filter
    if (dateRange.start && dateRange.end) {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999); // Include full end date
      
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.timestamps.created);
        return orderDate >= startDate && orderDate <= endDate;
      });
    }

    setFilteredOrders(filtered);
  };

  const calculateOrderStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const stats = {
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => ['submitted', 'pending_review'].includes(o.status)).length,
      processingOrders: orders.filter(o => ['approved', 'processing'].includes(o.status)).length,
      completedToday: orders.filter(o => {
        if (o.status !== 'completed' || !o.timestamps.completed) return false;
        const completedDate = new Date(o.timestamps.completed);
        return completedDate >= today && completedDate < tomorrow;
      }).length,
      rejectedToday: orders.filter(o => {
        if (o.status !== 'rejected' || !o.timestamps.updated) return false;
        const rejectedDate = new Date(o.timestamps.updated);
        return rejectedDate >= today && rejectedDate < tomorrow;
      }).length
    };

    setOrderStats(stats);
  };

  const handleOrderSelect = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetail(true);
  };

  const handleBackToList = () => {
    setSelectedOrder(null);
    setShowOrderDetail(false);
    setSelectedOrderIds(new Set()); // Clear selections when going back
  };

  const handleBulkSelection = (orderId: string, checked: boolean) => {
    const newSelection = new Set(selectedOrderIds);
    if (checked) {
      newSelection.add(orderId);
    } else {
      newSelection.delete(orderId);
    }
    setSelectedOrderIds(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allVisibleIds = filteredOrders.map(order => order.id);
      setSelectedOrderIds(new Set(allVisibleIds));
    } else {
      setSelectedOrderIds(new Set());
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedOrderIds.size === 0) return;

    try {
      // Here you would implement bulk actions
      console.log(`Performing ${bulkAction} on orders:`, Array.from(selectedOrderIds));
      
      // Reset selections after action
      setSelectedOrderIds(new Set());
      setBulkAction('');
    } catch (error) {
      console.error('Error performing bulk action:', error);
      setError(`Failed to perform ${bulkAction} on selected orders`);
    }
  };

  const getStatusColor = (status: OrderStatus): string => {
    switch (status) {
      case 'submitted': return 'status-submitted';
      case 'pending_review': return 'status-pending';
      case 'approved': return 'status-approved';
      case 'processing': return 'status-processing';
      case 'completed': return 'status-completed';
      case 'rejected': return 'status-rejected';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-cancelled';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high': return 'priority-high';
      case 'normal': return 'priority-normal';
      case 'low': return 'priority-low';
      default: return 'priority-normal';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading orders...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Real-time Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-high-contrast">Order Management</h1>
          <p className="text-medium-contrast">Real-time order processing and management dashboard</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
            connectionStatus.isConnected 
              ? 'connection-online' 
              : 'connection-offline'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              connectionStatus.isConnected ? 'bg-green-500' : 'bg-red-500'
            } ${connectionStatus.isReconnecting ? 'animate-pulse' : ''}`} />
            {connectionStatus.isConnected ? 'Connected' : 'Disconnected'}
          </div>
          
          {/* Notifications */}
          <RealTimeNotifications />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

             {/* Statistics Dashboard */}
       <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
         <div className="stat-card-enhanced p-4 md:p-6 rounded-lg">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-5 h-5 md:w-6 md:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
                         <div className="ml-3 md:ml-4">
               <p className="text-xs md:text-sm font-medium text-medium-contrast">Total Orders</p>
               <p className="text-lg md:text-2xl font-semibold text-high-contrast">{orderStats.totalOrders}</p>
             </div>
          </div>
        </div>

                 <div className="stat-card-enhanced p-4 md:p-6 rounded-lg">
           <div className="flex items-center">
             <div className="p-2 bg-yellow-100 rounded-lg">
               <svg className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
             </div>
             <div className="ml-3 md:ml-4">
               <p className="text-xs md:text-sm font-medium text-medium-contrast">Pending</p>
               <p className="text-lg md:text-2xl font-semibold text-high-contrast">{orderStats.pendingOrders}</p>
             </div>
           </div>
         </div>

                 <div className="stat-card-enhanced p-4 md:p-6 rounded-lg">
           <div className="flex items-center">
             <div className="p-2 bg-purple-100 rounded-lg">
               <svg className="w-5 h-5 md:w-6 md:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
               </svg>
             </div>
             <div className="ml-3 md:ml-4">
               <p className="text-xs md:text-sm font-medium text-medium-contrast">Processing</p>
               <p className="text-lg md:text-2xl font-semibold text-high-contrast">{orderStats.processingOrders}</p>
             </div>
           </div>
         </div>

         <div className="stat-card-enhanced p-4 md:p-6 rounded-lg">
           <div className="flex items-center">
             <div className="p-2 bg-green-100 rounded-lg">
               <svg className="w-5 h-5 md:w-6 md:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
               </svg>
             </div>
             <div className="ml-3 md:ml-4">
               <p className="text-xs md:text-sm font-medium text-medium-contrast">Completed Today</p>
               <p className="text-lg md:text-2xl font-semibold text-high-contrast">{orderStats.completedToday}</p>
             </div>
           </div>
         </div>

         <div className="stat-card-enhanced p-4 md:p-6 rounded-lg">
           <div className="flex items-center">
             <div className="p-2 bg-red-100 rounded-lg">
               <svg className="w-5 h-5 md:w-6 md:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
               </svg>
             </div>
             <div className="ml-3 md:ml-4">
               <p className="text-xs md:text-sm font-medium text-medium-contrast">Rejected Today</p>
               <p className="text-lg md:text-2xl font-semibold text-high-contrast">{orderStats.rejectedToday}</p>
             </div>
           </div>
         </div>
      </div>

      {/* Order Management Interface */}
      {showOrderDetail && selectedOrder ? (
        // Order Detail View with Chat
        <div className="space-y-6">
          {/* Back Button */}
          <div className="flex items-center">
            <button
              onClick={handleBackToList}
              className="btn-secondary-enhanced flex items-center px-4 py-2 rounded transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Orders
            </button>
          </div>

          {/* Order Information */}
          <div className="card-enhanced rounded-lg p-6">
            <h2 className="text-xl font-bold text-high-contrast mb-4">Order Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                  <h3 className="text-sm font-bold text-medium-contrast mb-2">Order Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-medium-contrast">Order ID:</span>
                      <span className="text-sm font-semibold text-high-contrast">{selectedOrder.orderId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-medium-contrast">Type:</span>
                      <span className="text-sm font-semibold text-high-contrast capitalize">{selectedOrder.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-medium-contrast">Status:</span>
                      <span className={`text-sm font-semibold px-2 py-1 rounded-full ${getStatusColor(selectedOrder.status)}`}>
                        {selectedOrder.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-medium-contrast">Amount:</span>
                      <span className="text-sm font-semibold text-high-contrast">{selectedOrder.submittedAmount.toFixed(2)} JOD</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-medium-contrast">Priority:</span>
                      <span className={`text-sm font-semibold px-2 py-1 rounded ${getPriorityColor(selectedOrder.priority)}`}>
                        {selectedOrder.priority}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-medium-contrast">Created:</span>
                      <span className="text-sm font-semibold text-high-contrast">
                        {new Date(selectedOrder.timestamps.created).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                              <div>
                  <h3 className="text-sm font-bold text-medium-contrast mb-2">Additional Information</h3>
                  <div className="space-y-2">
                    {selectedOrder.adminNotes && (
                      <div>
                        <span className="text-sm text-medium-contrast">Admin Notes:</span>
                        <p className="text-sm font-semibold text-high-contrast mt-1">{selectedOrder.adminNotes}</p>
                      </div>
                    )}
                    {selectedOrder.rejectionReason && (
                      <div>
                        <span className="text-sm text-medium-contrast">Rejection Reason:</span>
                        <p className="text-sm font-semibold mt-1 text-red-700">{selectedOrder.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                </div>
            </div>
          </div>

          {/* Order Workflow */}
          <OrderStatusWorkflow
            order={selectedOrder}
            onOrderUpdated={(updatedOrder) => {
              setSelectedOrder(updatedOrder);
              setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
            }}
            userRole="admin"
          />

          {/* Order Chat */}
          <OrderChat
            orderId={selectedOrder.orderId}
            className="mt-6"
          />
        </div>
      ) : (
        // Orders List View with Enhanced Filtering
        <div className="space-y-4">
                     {/* Advanced Filters */}
           <div className="card-enhanced rounded-lg p-4 md:p-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
               {/* Status Filter */}
               <div>
                 <label className="form-label-enhanced block mb-1">Status</label>
                 <select
                   value={statusFilter}
                   onChange={(e) => setStatusFilter(e.target.value)}
                   className="form-input-enhanced focus-enhanced w-full px-3 py-2 rounded-md"
                 >
                  <option value="all">All Statuses</option>
                  <option value="submitted">Submitted</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="approved">Approved</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

                             {/* Type Filter */}
               <div>
                 <label className="form-label-enhanced block mb-1">Type</label>
                 <select
                   value={typeFilter}
                   onChange={(e) => setTypeFilter(e.target.value)}
                   className="form-input-enhanced focus-enhanced w-full px-3 py-2 rounded-md"
                 >
                   <option value="all">All Types</option>
                   <option value="incoming">Incoming</option>
                   <option value="outgoing">Outgoing</option>
                 </select>
               </div>

               {/* Search */}
               <div>
                 <label className="form-label-enhanced block mb-1">Search</label>
                 <input
                   type="text"
                   placeholder="Order ID, amount, name..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="form-input-enhanced focus-enhanced w-full px-3 py-2 rounded-md"
                 />
               </div>

               {/* Date Range Start */}
               <div>
                 <label className="form-label-enhanced block mb-1">From Date</label>
                 <input
                   type="date"
                   value={dateRange.start}
                   onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                   className="form-input-enhanced focus-enhanced w-full px-3 py-2 rounded-md"
                 />
               </div>

               {/* Date Range End */}
               <div>
                 <label className="form-label-enhanced block mb-1">To Date</label>
                 <input
                   type="date"
                   value={dateRange.end}
                   onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                   className="form-input-enhanced focus-enhanced w-full px-3 py-2 rounded-md"
                 />
               </div>
            </div>

                         {/* Filter Results Info */}
             <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-gray-200">
               <div className="text-sm text-medium-contrast">
                 Showing {filteredOrders.length} of {orders.length} orders
               </div>
               
               {/* Clear Filters */}
               {(statusFilter !== 'all' || typeFilter !== 'all' || searchTerm || dateRange.start || dateRange.end) && (
                 <button
                   onClick={() => {
                     setStatusFilter('all');
                     setTypeFilter('all');
                     setSearchTerm('');
                     setDateRange({ start: '', end: '' });
                   }}
                   className="btn-secondary-enhanced text-sm px-3 py-1 rounded"
                 >
                   Clear Filters
                 </button>
               )}
             </div>
          </div>

                     {/* Bulk Actions */}
           {selectedOrderIds.size > 0 && (
             <div className="notification-info rounded-lg p-4">
               <div className="flex items-center justify-between">
                 <div className="flex items-center space-x-4">
                   <span className="text-sm font-semibold text-high-contrast">
                     {selectedOrderIds.size} order(s) selected
                   </span>
                   <select
                     value={bulkAction}
                     onChange={(e) => setBulkAction(e.target.value)}
                     className="form-input-enhanced focus-enhanced px-3 py-1 rounded-md text-sm"
                   >
                     <option value="">Select action...</option>
                     <option value="approve">Approve Selected</option>
                     <option value="reject">Reject Selected</option>
                     <option value="export">Export Selected</option>
                   </select>
                   <button
                     onClick={handleBulkAction}
                     disabled={!bulkAction}
                     className="btn-primary-enhanced px-4 py-1 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     Apply
                   </button>
                 </div>
                 <button
                   onClick={() => setSelectedOrderIds(new Set())}
                   className="btn-secondary-enhanced text-sm px-3 py-1 rounded"
                 >
                   Clear Selection
                 </button>
               </div>
             </div>
           )}

                     {/* Orders List */}
           <div className="card-enhanced rounded-lg overflow-hidden">
             {/* Table Header */}
             <div className="table-header-enhanced px-4 py-3">
               <div className="flex items-center justify-between">
                 <div className="flex items-center space-x-3">
                   <input
                     type="checkbox"
                     checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}
                     onChange={(e) => handleSelectAll(e.target.checked)}
                     className="focus-enhanced rounded border-gray-300 text-blue-600"
                   />
                   <h3 className="text-lg font-bold text-high-contrast">Orders</h3>
                 </div>
                 <div className="flex items-center space-x-2">
                   <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                   <span className="text-xs font-semibold text-green-700">Live Updates</span>
                 </div>
               </div>
             </div>

                         {/* Orders */}
             <div className="divide-y-2 divide-gray-200">
               {filteredOrders.length === 0 ? (
                 <div className="p-8 text-center">
                   <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                     <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                     </svg>
                   </div>
                   <h4 className="text-lg font-bold text-high-contrast mb-2">No Orders Found</h4>
                   <p className="text-medium-contrast">
                     {orders.length === 0 
                       ? "No orders have been created yet. New orders will appear here automatically."
                       : "No orders match your current filters. Try adjusting your search criteria."
                     }
                   </p>
                 </div>
                             ) : (
                                  filteredOrders.map((order) => (
                   <div 
                     key={order.id} 
                     className="table-row-enhanced transition-colors duration-150 cursor-pointer"
                     onClick={() => handleOrderSelect(order)}
                   >
                     <div className="p-4 md:p-6">
                       <div className="flex items-start space-x-3">
                         {/* Checkbox */}
                         <input
                           type="checkbox"
                           checked={selectedOrderIds.has(order.id)}
                           onChange={(e) => {
                             e.stopPropagation();
                             handleBulkSelection(order.id, e.target.checked);
                           }}
                           onClick={(e) => e.stopPropagation()}
                           className="focus-enhanced mt-1 rounded border-gray-300 text-blue-600"
                         />

                        {/* Order Type Icon */}
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {order.type === 'incoming' ? '↓' : '↑'}
                          </span>
                        </div>

                                                 {/* Order Details */}
                         <div className="flex-grow min-w-0">
                           <div className="flex items-center justify-between mb-2">
                             <div>
                               <h4 className="font-bold text-high-contrast">{order.orderId}</h4>
                               <p className="text-sm text-medium-contrast">
                                 {order.type.charAt(0).toUpperCase() + order.type.slice(1)} Transfer
                               </p>
                             </div>
                             <div className="flex items-center space-x-2">
                               <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                                 {order.status.replace('_', ' ').toUpperCase()}
                               </span>
                               <span className={`px-2 py-1 text-xs font-semibold rounded ${getPriorityColor(order.priority)}`}>
                                 {order.priority.toUpperCase()}
                               </span>
                             </div>
                           </div>

                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                             <div>
                               <span className="text-medium-contrast">Amount:</span>
                               <div className="font-semibold text-high-contrast">{order.submittedAmount.toFixed(2)} JOD</div>
                             </div>
                             <div>
                               <span className="text-medium-contrast">Created:</span>
                               <div className="font-semibold text-high-contrast">
                                 {new Date(order.timestamps.created).toLocaleDateString()}
                               </div>
                             </div>
                             <div>
                               <span className="text-medium-contrast">Exchange:</span>
                               <div className="font-semibold text-high-contrast truncate">
                                 {order.exchangeId || 'Unknown'}
                               </div>
                             </div>
                             <div>
                               <span className="text-medium-contrast">Commission:</span>
                               <div className="font-semibold text-high-contrast">
                                 {order.commission ? `${order.commission.toFixed(2)} JOD` : 'TBD'}
                               </div>
                             </div>
                           </div>

                                                     {/* Progress indicator for processing orders */}
                           {order.status === 'processing' && (
                             <div className="mt-3">
                               <div className="w-full bg-gray-200 rounded-full h-2">
                                 <div className="bg-purple-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                               </div>
                               <p className="text-xs text-purple-700 font-semibold mt-1">Processing in progress...</p>
                             </div>
                           )}
                        </div>

                        {/* Action Arrow */}
                        <div className="flex-shrink-0">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

                     {/* Pagination placeholder */}
           {filteredOrders.length > 50 && (
             <div className="text-center pt-4">
               <button className="btn-secondary-enhanced px-6 py-2 text-sm rounded-lg transition-colors">
                 Load More Orders
               </button>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default AdminOrderDashboard; 