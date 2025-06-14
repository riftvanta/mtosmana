'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  getOrder,
  updateOrderStatus, 
  getOrderStatistics,
  bulkUpdateOrderStatus,
  getNextAllowedStatuses
} from '@/lib/orderOperations';
import { useAuth } from '@/contexts/AuthContext';
import OutgoingTransferForm from './OutgoingTransferForm';
import IncomingTransferForm from './IncomingTransferForm';
import OrderStatusWorkflow from './OrderStatusWorkflow';
import IndexBuildingNotice from './IndexBuildingNotice';

interface OrderManagementProps {
  userRole: 'admin' | 'exchange';
  userCommissionRate?: CommissionRate;
  assignedBanks?: (BankAssignment & { bank: PlatformBank })[];
  platformBanks?: PlatformBank[];
}

type ViewMode = 'list' | 'create-outgoing' | 'create-incoming' | 'view-order' | 'edit-order';

const OrderManagement: React.FC<OrderManagementProps> = ({
  userRole,
  userCommissionRate,
  assignedBanks = [],
  platformBanks = []
}) => {
  const { user } = useAuth();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  
  // Status update modal state
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateTargetOrder, setUpdateTargetOrder] = useState<Order | null>(null);
  const [updateStatus, setUpdateStatus] = useState<OrderStatus | ''>('');
  const [updateNotes, setUpdateNotes] = useState('');
  const [updateReason, setUpdateReason] = useState('');

  // Cancel confirmation modal state
  const [showCancelModal, setCancelModal] = useState(false);
  const [cancelTargetOrder, setCancelTargetOrder] = useState<Order | null>(null);
  const [cancelAction, setCancelAction] = useState<'cancel' | 'request'>('cancel');

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

  // Load single order for viewing
  const loadOrder = useCallback(async (orderId: string) => {
    if (!orderId) return;

    setLoadingOrder(true);
    try {
      const order = await getOrder(orderId);
      setSelectedOrder(order);
    } catch (err) {
      console.error('Error loading order:', err);
      setError('Failed to load order details');
    } finally {
      setLoadingOrder(false);
    }
  }, []);

  // Load order when selectedOrderId changes and we're in view mode
  useEffect(() => {
    if (selectedOrderId && viewMode === 'view-order') {
      loadOrder(selectedOrderId);
    }
  }, [selectedOrderId, viewMode, loadOrder]);

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

  // Handle status update
  const handleStatusUpdateSubmit = async () => {
    if (!updateTargetOrder || !updateStatus || !user) return;

    try {
      const success = await updateOrderStatus(
        updateTargetOrder.orderId,
        updateStatus as OrderStatus,
        user.id,
        userRole,
        updateNotes || undefined,
        updateReason || undefined
      );

      if (success) {
        loadOrders();
        loadStatistics();
        setShowUpdateModal(false);
        // Refresh the selected order if we're in view mode
        if (viewMode === 'view-order' && selectedOrderId) {
          loadOrder(selectedOrderId);
        }
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      setError('Failed to update order status');
    }
  };

  // Get allowed status transitions for the update modal
  const getAllowedStatusOptions = (currentStatus: OrderStatus) => {
    const allowedStatuses = getNextAllowedStatuses(currentStatus, userRole);
    return allowedStatuses;
  };

  // Get user-friendly status label
  const getStatusLabel = (status: OrderStatus): string => {
    switch (status) {
      case 'processing': return 'APPROVE & PROCESS';
      case 'rejected': return 'REJECT';
      case 'completed': return 'COMPLETE';
      case 'cancelled': return 'CANCEL';
      default: return status.replace('_', ' ').toUpperCase();
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

  // Handle simple cancellation for submitted orders
  const handleCancelOrder = async (order: Order) => {
    setCancelTargetOrder(order);
    setCancelAction('cancel');
    setCancelModal(true);
  };

  // Handle cancellation request for processing orders
  const handleRequestCancellation = async (order: Order) => {
    setCancelTargetOrder(order);
    setCancelAction('request');
    setCancelModal(true);
  };

  // Execute the actual cancellation
  const executeCancellation = async () => {
    if (!cancelTargetOrder || !user) return;

    try {
      const targetStatus = cancelAction === 'cancel' ? 'cancelled' : 'cancellation_requested';
      const notes = cancelAction === 'cancel' ? 'Order cancelled by user' : 'Cancellation requested by user';
      const reason = cancelAction === 'cancel' ? 'User cancellation' : 'User requested cancellation';

      const success = await updateOrderStatus(
        cancelTargetOrder.orderId,
        targetStatus,
        user.id,
        userRole,
        notes,
        reason
      );

      if (success) {
        loadOrders();
        loadStatistics();
        setCancelModal(false);
        setCancelTargetOrder(null);
      }
    } catch (err) {
      console.error('Error processing cancellation:', err);
      setError('Failed to process cancellation');
    }
  };

  // Get cancel button for order based on status
  const getCancelButton = (order: Order) => {
    if (order.status === 'submitted') {
      return (
        <button
          onClick={() => handleCancelOrder(order)}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-medium"
        >
          Cancel Order
        </button>
      );
    } else if (order.status === 'processing') {
      return (
        <button
          onClick={() => handleRequestCancellation(order)}
          className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-medium"
        >
          Request Cancellation
        </button>
      );
    }
    return null;
  };

  // Get cancel button for table view (text links)
  const getCancelButtonForTable = (order: Order) => {
    if (order.status === 'submitted') {
      return (
        <button
          onClick={() => handleCancelOrder(order)}
          className="text-red-600 hover:text-red-900"
        >
          Cancel
        </button>
      );
    } else if (order.status === 'processing') {
      return (
        <button
          onClick={() => handleRequestCancellation(order)}
          className="text-orange-600 hover:text-orange-900"
        >
          Request Cancellation
        </button>
      );
    }
    return null;
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

  if (viewMode === 'edit-order' && selectedOrder && userCommissionRate) {
    if (selectedOrder.type === 'outgoing') {
      return (
        <OutgoingTransferForm
          onOrderCreated={(orderId) => {
            // Reload the order and go back to view mode
            loadOrder(orderId);
            setViewMode('view-order');
          }}
          onCancel={() => setViewMode('view-order')}
          userCommissionRate={userCommissionRate}
          editMode={true}
          existingOrder={selectedOrder}
        />
      );
    } else {
      return (
        <IncomingTransferForm
          onOrderCreated={(orderId) => {
            // Reload the order and go back to view mode
            loadOrder(orderId);
            setViewMode('view-order');
          }}
          onCancel={() => setViewMode('view-order')}
          userCommissionRate={userCommissionRate}
          assignedBanks={assignedBanks}
          editMode={true}
          existingOrder={selectedOrder}
        />
      );
    }
  }

  if (viewMode === 'view-order') {
    return (
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => {
                setViewMode('list');
                setSelectedOrderId(null);
                setSelectedOrder(null);
              }}
              className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Order Details</h1>
              <p className="text-gray-600">View and manage order: {selectedOrderId}</p>
            </div>
          </div>
        </div>

        {/* Order Details Content */}
        {loadingOrder ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading order details...</p>
          </div>
        ) : selectedOrder ? (
          <div className="space-y-6">
            {/* Order Information Card */}
            <div className="bg-white rounded-lg shadow border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Order ID</p>
                  <p className="text-sm text-gray-900">{selectedOrder.orderId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Type</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    selectedOrder.type === 'incoming' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {selectedOrder.type}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Amount</p>
                  <p className="text-sm text-gray-900">{selectedOrder.submittedAmount.toFixed(2)} JOD</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Commission</p>
                  <p className="text-sm text-gray-900">{selectedOrder.commission.toFixed(2)} JOD</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Priority</p>
                  <span className={`text-sm font-medium ${getPriorityColor(selectedOrder.priority)}`}>
                    {selectedOrder.priority}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Created</p>
                  <p className="text-sm text-gray-900">{formatDate(selectedOrder.timestamps.created)}</p>
                </div>
                {selectedOrder.senderDetails && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Sender</p>
                    <p className="text-sm text-gray-900">{selectedOrder.senderDetails.name}</p>
                  </div>
                )}
                {selectedOrder.recipientDetails && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Recipient</p>
                    <p className="text-sm text-gray-900">{selectedOrder.recipientDetails.name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            {(getCancelButton(selectedOrder) || (selectedOrder.status === 'submitted' && userRole === 'exchange')) && (
              <div className="bg-white rounded-lg shadow border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="flex gap-3">
                  {selectedOrder.status === 'submitted' && userRole === 'exchange' && (
                    <button
                      onClick={() => setViewMode('edit-order')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                    >
                      <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Order
                    </button>
                  )}
                  {getCancelButton(selectedOrder)}
                </div>
              </div>
            )}

            {/* Order Workflow */}
            <OrderStatusWorkflow
              order={selectedOrder}
              onOrderUpdated={(updatedOrder) => {
                setSelectedOrder(updatedOrder);
                loadOrders();
                loadStatistics();
              }}
              userRole={userRole}
            />
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="text-red-600 mb-2">
              <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-600">Order not found</p>
            <button
              onClick={() => setViewMode('list')}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Back to List
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center">
          <button
            onClick={() => router.back()}
            className="mr-4 p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
            title="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
            <p className="text-gray-600">Manage and track transfer orders</p>
          </div>
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
                onClick={() => handleBulkStatusUpdate('processing')}
                disabled={bulkLoading}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                Approve & Process
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
                        {userRole === 'admin' && canUpdateStatus(order.status) && (
                          <button
                            onClick={() => {
                              setShowUpdateModal(true);
                              setUpdateTargetOrder(order);
                              setUpdateStatus(order.status);
                              setUpdateNotes('');
                              setUpdateReason('');
                            }}
                            className="text-green-600 hover:text-green-900"
                          >
                            Update
                          </button>
                        )}
                        {getCancelButtonForTable(order)}
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
                      {userRole === 'admin' && canUpdateStatus(order.status) && (
                        <button
                          onClick={() => {
                            setShowUpdateModal(true);
                            setUpdateTargetOrder(order);
                            setUpdateStatus(order.status);
                            setUpdateNotes('');
                            setUpdateReason('');
                          }}
                          className="text-green-600 hover:text-green-900 text-sm"
                        >
                          Update
                        </button>
                      )}
                      {getCancelButtonForTable(order)}
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

      {/* Status Update Modal */}
      {showUpdateModal && updateTargetOrder && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Update Order Status</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Current Status: <span className="font-medium">{updateTargetOrder.status.replace('_', ' ')}</span>
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Status
                </label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value as OrderStatus)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Status</option>
                  {getAllowedStatusOptions(updateTargetOrder.status).map(status => (
                    <option key={status} value={status}>
                      {getStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={updateNotes}
                  onChange={(e) => setUpdateNotes(e.target.value)}
                  placeholder="Add notes about this status change"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason (Optional)
                </label>
                <textarea
                  value={updateReason}
                  onChange={(e) => setUpdateReason(e.target.value)}
                  placeholder="Reason for this status change"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-6 flex space-x-3">
              <button
                onClick={handleStatusUpdateSubmit}
                disabled={!updateStatus}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Update Status
              </button>
              <button
                onClick={() => {
                  setShowUpdateModal(false);
                  setUpdateStatus('');
                  setUpdateNotes('');
                  setUpdateReason('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && cancelTargetOrder && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
            {/* Header with Icon */}
            <div className="flex items-center mb-6">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                cancelAction === 'cancel' ? 'bg-red-100' : 'bg-orange-100'
              }`}>
                <svg className={`w-6 h-6 ${
                  cancelAction === 'cancel' ? 'text-red-600' : 'text-orange-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5C3.312 16.333 4.27 18 5.81 18z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {cancelAction === 'cancel' ? 'Cancel Order' : 'Request Cancellation'}
                </h3>
                <p className="text-sm text-gray-500">Order {cancelTargetOrder.orderId}</p>
              </div>
            </div>

            {/* Question */}
            <div className="mb-6">
              <p className="text-gray-700 font-medium mb-2">
                {cancelAction === 'cancel' 
                  ? `Are you sure you want to cancel order ${cancelTargetOrder.orderId}?`
                  : `Are you sure you want to request cancellation for order ${cancelTargetOrder.orderId}?`
                }
              </p>
              
              {/* Consequences */}
              <p className="text-sm text-gray-600">
                {cancelAction === 'cancel' 
                  ? 'This action will immediately cancel the order and cannot be undone. You will need to create a new order if needed.'
                  : 'This will send a cancellation request to the admin for review. The order will remain in processing until the admin makes a decision.'
                }
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCancelModal(false);
                  setCancelTargetOrder(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 font-medium"
              >
                Keep Order
              </button>
              <button
                onClick={executeCancellation}
                className={`flex-1 px-4 py-2 text-white rounded-md focus:outline-none focus:ring-2 font-medium ${
                  cancelAction === 'cancel'
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                    : 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500'
                }`}
              >
                {cancelAction === 'cancel' ? 'Cancel Order' : 'Request Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;