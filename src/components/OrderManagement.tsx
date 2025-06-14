'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Order, 
  OrderStatus, 
  OrderType,
  OrderFilters,
  OrderSortOptions,
  PaginatedResponse,
  BankAssignment,
  PlatformBank,
  OrderStatistics,
  CommissionRate
} from '@/types';
import { 
  getOrders, 
  updateOrderStatus, 
  getOrderStatistics,
  bulkUpdateOrderStatus
} from '@/lib/orderOperations';
import { useAuth } from '@/contexts/AuthContext';
import OutgoingTransferForm from './OutgoingTransferForm';
import IncomingTransferForm from './IncomingTransferForm';
import IndexBuildingNotice from './IndexBuildingNotice';

interface OrderManagementProps {
  userRole: 'admin' | 'exchange';
  userCommissionRate?: CommissionRate;
  assignedBanks?: (BankAssignment & { bank: PlatformBank })[];
  platformBanks?: PlatformBank[];
}

type ViewMode = 'list' | 'create-outgoing' | 'create-incoming' | 'view-order';

const OrderManagement: React.FC<OrderManagementProps> = ({
  userRole,
  userCommissionRate,
  assignedBanks = [],
  platformBanks = []
}) => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
  // Order list state
  const [orders, setOrders] = useState<PaginatedResponse<Order>>({
    items: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters and sorting
  const [filters, setFilters] = useState<OrderFilters>({});
  const [sortOptions, setSortOptions] = useState<OrderSortOptions>({
    field: 'created',
    direction: 'desc'
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Statistics
  const [statistics, setStatistics] = useState<OrderStatistics | null>(null);

  // Selection for bulk operations
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Load orders
  const loadOrders = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Apply user-specific filters for exchanges
      const userFilters: OrderFilters = {
        ...filters,
        ...(userRole === 'exchange' ? { exchangeId: [user.id] } : {})
      };

      const result = await getOrders(userFilters, sortOptions, {
        page: currentPage,
        limit: 10
      });

      setOrders(result);
    } catch (err) {
      console.error('Error loading orders:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load orders';
      
      if (errorMessage.includes('index') || errorMessage.includes('Index')) {
        setError('Database indices are being built. Please wait a few minutes and refresh the page.');
      } else {
        setError(errorMessage);
      }
      
      // Set empty state to avoid UI issues
      setOrders({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false
      });
    } finally {
      setLoading(false);
    }
  }, [user, filters, sortOptions, currentPage, userRole]);

  // Load statistics
  const loadStatistics = useCallback(async () => {
    if (!user) return;

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90); // Last 90 days instead of 30

      const stats = await getOrderStatistics(
        startDate, 
        endDate, 
        userRole === 'exchange' ? user.id : undefined
      );
      setStatistics(stats);
    } catch (err) {
      console.error('Error loading statistics:', err);
    }
  }, [user, userRole]);

  // Initial load
  useEffect(() => {
    loadOrders();
    loadStatistics();
  }, [loadOrders, loadStatistics]);

  // Auto-refresh orders every 30 seconds (disabled while indices are building)
  useEffect(() => {
    const interval = setInterval(() => {
      if (viewMode === 'list' && !error?.includes('indices are building')) {
        loadOrders();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loadOrders, viewMode, error]);

  const handleFilterChange = useCallback((newFilters: Partial<OrderFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  }, []);

  const handleSortChange = useCallback((field: OrderSortOptions['field']) => {
    setSortOptions(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
    setCurrentPage(1);
  }, []);

  const handleOrderCreated = useCallback((orderId: string) => {
    setViewMode('list');
    loadOrders();
    loadStatistics();
    // Show success message or redirect to view the created order
  }, [loadOrders, loadStatistics]);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus, notes?: string, reason?: string) => {
    if (!user) return;

    try {
      const success = await updateOrderStatus(
        orderId,
        newStatus,
        user.id,
        userRole,
        notes,
        reason
      );

      if (success) {
        loadOrders();
        loadStatistics();
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      setError('Failed to update order status');
    }
  };

  const handleBulkStatusUpdate = async (newStatus: OrderStatus, notes?: string) => {
    if (selectedOrders.length === 0 || !user) return;

    setBulkLoading(true);
    try {
      const result = await bulkUpdateOrderStatus(
        selectedOrders,
        newStatus,
        user.id,
        notes
      );

      if (result.success.length > 0) {
        loadOrders();
        loadStatistics();
        setSelectedOrders([]);
      }

      if (result.failed.length > 0) {
        setError(`Failed to update ${result.failed.length} orders`);
      }
    } catch (err) {
      console.error('Error in bulk update:', err);
      setError('Failed to update orders');
    } finally {
      setBulkLoading(false);
    }
  };

  const getStatusColor = (status: OrderStatus): string => {
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

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'urgent': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'normal': return 'text-gray-600';
      case 'low': return 'text-gray-400';
      default: return 'text-gray-600';
    }
  };

  const canUpdateStatus = (currentStatus: OrderStatus): boolean => {
    if (userRole === 'admin') return true;
    return ['submitted', 'approved', 'processing'].includes(currentStatus);
  };

  // Safe date formatting function to handle various timestamp formats
  const formatDate = (timestamp: Date | number | string | { toDate?: () => Date; seconds?: number } | null | undefined): string => {
    try {
      if (!timestamp) return 'Unknown date';
      
      let date: Date;
      
      // Handle Firestore Timestamp object
      if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      }
      // Handle Date object
      else if (timestamp instanceof Date) {
        date = timestamp;
      }
      // Handle Unix timestamp (seconds)
      else if (typeof timestamp === 'number' && timestamp > 1000000000 && timestamp < 10000000000) {
        date = new Date(timestamp * 1000);
      }
      // Handle Unix timestamp (milliseconds)
      else if (typeof timestamp === 'number' && timestamp > 1000000000000) {
        date = new Date(timestamp);
      }
      // Handle string dates
      else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      }
      // Handle object with seconds property (Firestore format)
      else if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      }
      // Fallback to current date
      else {
        console.warn('Unknown timestamp format:', timestamp);
        return 'Unknown date';
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date created from timestamp:', timestamp);
        return 'Unknown date';
      }
      
      return date.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting date:', error, 'Timestamp:', timestamp);
      return 'Unknown date';
    }
  };

  if (viewMode === 'create-outgoing' && userCommissionRate) {
    return (
      <OutgoingTransferForm
        onOrderCreated={handleOrderCreated}
        onCancel={() => setViewMode('list')}
        userCommissionRate={userCommissionRate}
      />
    );
  }

  if (viewMode === 'create-incoming' && userCommissionRate) {
    return (
      <IncomingTransferForm
        onOrderCreated={handleOrderCreated}
        onCancel={() => setViewMode('list')}
        userCommissionRate={userCommissionRate}
        assignedBanks={assignedBanks}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
          <p className="text-gray-600">Manage and track transfer orders</p>
        </div>
        
        {userRole === 'exchange' && (
          <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0">
            <button
              onClick={() => setViewMode('create-outgoing')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Outgoing Transfer
            </button>
            <button
              onClick={() => setViewMode('create-incoming')}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Incoming Transfer
            </button>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.totalOrders}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Volume</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.totalVolume.toFixed(0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Commission</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.totalCommission.toFixed(0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Processing</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.processingTime.average}m</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white p-3 md:p-4 rounded-lg shadow border">
        <div className="space-y-3">
          {/* First line: Status and Type dropdowns */}
          <div className="flex gap-2 md:gap-4">
            <div className="flex-1">
              <select
                value={filters.status?.[0] || ''}
                onChange={(e) => handleFilterChange({ status: e.target.value ? [e.target.value as OrderStatus] : undefined })}
                className="w-full px-2 md:px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="cancellation_requested">Cancellation Requested</option>
              </select>
            </div>

            <div className="flex-1">
              <select
                value={filters.type?.[0] || ''}
                onChange={(e) => handleFilterChange({ type: e.target.value ? [e.target.value as OrderType] : undefined })}
                className="w-full px-2 md:px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="incoming">Incoming</option>
                <option value="outgoing">Outgoing</option>
              </select>
            </div>
          </div>

          {/* Second line: Search field and Clear button */}
          <div className="flex gap-2 md:gap-4">
            <div className="flex-1 min-w-0">
              <input
                type="text"
                placeholder="Search Order ID, amount, or notes..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange({ search: e.target.value || undefined })}
                className="w-full px-2 md:px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex-shrink-0">
              <button
                onClick={() => {
                  setFilters({});
                  setCurrentPage(1);
                }}
                className="h-9 w-9 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center"
                title="Clear Filters"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions (Admin only) */}
      {userRole === 'admin' && selectedOrders.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">
              {selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkStatusUpdate('approved')}
                disabled={bulkLoading}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                Approve
              </button>
              <button
                onClick={() => handleBulkStatusUpdate('rejected')}
                disabled={bulkLoading}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-gray-400"
              >
                Reject
              </button>
              <button
                onClick={() => setSelectedOrders([])}
                className="px-3 py-1 bg-gray-200 text-gray-800 text-sm rounded hover:bg-gray-300"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orders List */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading orders...</p>
          </div>
        ) : error ? (
          <div className="p-6">
            {error.includes('indices are building') || error.includes('index') ? (
              <IndexBuildingNotice />
            ) : (
              <div className="text-center">
                <div className="text-red-600 mb-2">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-red-600">{error}</p>
                <button
                  onClick={loadOrders}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        ) : orders.items.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-2">
              <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-600">No orders found</p>
            {userRole === 'exchange' && (
              <div className="mt-4 space-x-2">
                <button
                  onClick={() => setViewMode('create-outgoing')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create Outgoing Transfer
                </button>
                <button
                  onClick={() => setViewMode('create-incoming')}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Create Incoming Transfer
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {userRole === 'admin' && (
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedOrders.length === orders.items.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOrders(orders.items.map(order => order.orderId));
                            } else {
                              setSelectedOrders([]);
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </th>
                    )}
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSortChange('orderId')}
                    >
                      Order ID
                      {sortOptions.field === 'orderId' && (
                        <span className="ml-1">
                          {sortOptions.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSortChange('amount')}
                    >
                      Amount
                      {sortOptions.field === 'amount' && (
                        <span className="ml-1">
                          {sortOptions.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSortChange('created')}
                    >
                      Created
                      {sortOptions.field === 'created' && (
                        <span className="ml-1">
                          {sortOptions.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.items.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      {userRole === 'admin' && (
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(order.orderId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrders(prev => [...prev, order.orderId]);
                              } else {
                                setSelectedOrders(prev => prev.filter(id => id !== order.orderId));
                              }
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{order.orderId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          order.type === 'incoming' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {order.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {order.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{order.submittedAmount.toFixed(2)} JOD</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getPriorityColor(order.priority)}`}>
                          {order.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(order.timestamps.created)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => {
                            setSelectedOrderId(order.orderId);
                            setViewMode('view-order');
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </button>
                        {canUpdateStatus(order.status) && (
                          <button
                            onClick={() => {
                              // Handle status update - could open a modal
                            }}
                            className="text-green-600 hover:text-green-900"
                          >
                            Update
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4 p-4">
              {orders.items.map((order) => (
                <div key={order.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900">{order.orderId}</div>
                      <div className="text-sm text-gray-500">{formatDate(order.timestamps.created)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">{order.submittedAmount.toFixed(2)} JOD</div>
                      <span className={`text-sm font-medium ${getPriorityColor(order.priority)}`}>
                        {order.priority}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex space-x-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        order.type === 'incoming' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {order.type}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedOrderId(order.orderId);
                          setViewMode('view-order');
                        }}
                        className="text-blue-600 hover:text-blue-900 text-sm"
                      >
                        View
                      </button>
                      {canUpdateStatus(order.status) && (
                        <button
                          onClick={() => {
                            // Handle status update
                          }}
                          className="text-green-600 hover:text-green-900 text-sm"
                        >
                          Update
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {orders.totalPages > 1 && (
              <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={!orders.hasPrevious}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(orders.totalPages, prev + 1))}
                    disabled={!orders.hasNext}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(currentPage - 1) * 10 + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(currentPage * 10, orders.total)}</span> of{' '}
                      <span className="font-medium">{orders.total}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={!orders.hasPrevious}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {Array.from({ length: Math.min(5, orders.totalPages) }, (_, i) => {
                        const pageNum = i + Math.max(1, currentPage - 2);
                        if (pageNum > orders.totalPages) return null;
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              pageNum === currentPage
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(orders.totalPages, prev + 1))}
                        disabled={!orders.hasNext}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OrderManagement;