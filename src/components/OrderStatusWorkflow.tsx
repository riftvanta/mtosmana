'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Order,
  OrderStatus,
  OrderAction,
  WorkflowTask,
  WorkflowEvent,
  User
} from '@/types';
import {
  getWorkflowEngine,
  WorkflowCondition,
  WorkflowEventType
} from '@/lib/workflowEngine';
import { getNextAllowedStatuses, isValidStatusTransition } from '@/lib/orderOperations';
import { useAuth } from '@/contexts/AuthContext';

interface OrderStatusWorkflowProps {
  order: Order;
  onOrderUpdated: (order: Order) => void;
  userRole: 'admin' | 'exchange';
  className?: string;
}

interface StatusTransitionForm {
  targetStatus: OrderStatus;
  notes: string;
  reason: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  conditions: WorkflowCondition[];
}

const OrderStatusWorkflow: React.FC<OrderStatusWorkflowProps> = ({
  order,
  onOrderUpdated,
  userRole,
  className = ''
}) => {
  const { user } = useAuth();
  const [workflowEngine] = useState(() => getWorkflowEngine());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransitionForm, setShowTransitionForm] = useState(false);
  const [recentEvents, setRecentEvents] = useState<WorkflowEvent[]>([]);
  const [activeTasks, setActiveTasks] = useState<WorkflowTask[]>([]);
  
  const [transitionForm, setTransitionForm] = useState<StatusTransitionForm>({
    targetStatus: order.status,
    notes: '',
    reason: '',
    priority: 'normal',
    conditions: []
  });

  // Real-time monitoring
  useEffect(() => {
    if (!order.orderId) return;

    const listenerId = workflowEngine.startOrderMonitoring(order.orderId, (updatedOrder) => {
      onOrderUpdated(updatedOrder);
    });

    return () => {
      workflowEngine.stopOrderMonitoring(listenerId);
    };
  }, [order.orderId, workflowEngine, onOrderUpdated]);

  // Load workflow events and active tasks
  useEffect(() => {
    loadWorkflowData();
  }, [order.orderId]);

  const loadWorkflowData = async () => {
    try {
      // This would typically load from Firestore
      // For now, we'll simulate the data
      setRecentEvents([]);
      setActiveTasks([]);
    } catch (error) {
      console.error('Error loading workflow data:', error);
    }
  };

  const getStatusColor = (status: OrderStatus): string => {
    switch (status) {
      case 'submitted': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending_review': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'processing': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancellation_requested': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'submitted':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        );
      case 'pending_review':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'approved':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'rejected':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'processing':
        return (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'completed':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'cancelled':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const handleStatusTransition = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const result = await workflowEngine.executeStatusTransition(
        order.orderId,
        transitionForm.targetStatus,
        user.id,
        userRole,
        {
          notes: transitionForm.notes,
          reason: transitionForm.reason,
          priority: transitionForm.priority,
          conditions: transitionForm.conditions
        }
      );

      if (result.success) {
        setShowTransitionForm(false);
        setTransitionForm({
          targetStatus: order.status,
          notes: '',
          reason: '',
          priority: 'normal',
          conditions: []
        });
        // Refresh workflow data
        loadWorkflowData();
      } else {
        setError(result.error || 'Failed to execute status transition');
      }
    } catch (err) {
      console.error('Error executing status transition:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const allowedNextStatuses = getNextAllowedStatuses(order.status, userRole);
  const canTransition = allowedNextStatuses.length > 0;

  // Workflow progress visualization
  const workflowSteps: { status: OrderStatus; label: string; description: string }[] = [
    { status: 'submitted', label: 'Submitted', description: 'Order has been submitted' },
    { status: 'pending_review', label: 'Under Review', description: 'Waiting for admin review' },
    { status: 'approved', label: 'Approved', description: 'Order has been approved' },
    { status: 'processing', label: 'Processing', description: 'Order is being processed' },
    { status: 'completed', label: 'Completed', description: 'Order has been completed' }
  ];

  const getCurrentStepIndex = () => {
    return workflowSteps.findIndex(step => step.status === order.status);
  };

  const currentStepIndex = getCurrentStepIndex();

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Order Workflow</h3>
          <div className={`flex items-center px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(order.status)}`}>
            {getStatusIcon(order.status)}
            <span className="ml-2">{order.status.replace('_', ' ').toUpperCase()}</span>
          </div>
        </div>

        {/* Workflow Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            {workflowSteps.map((step, index) => (
              <div key={step.status} className="flex flex-col items-center flex-1">
                {/* Step Circle */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                  index <= currentStepIndex 
                    ? 'bg-blue-500 text-white border-blue-500' 
                    : index === currentStepIndex + 1 && (order.status === 'rejected' || order.status === 'cancelled')
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-gray-100 text-gray-400 border-gray-300'
                }`}>
                  {index <= currentStepIndex || (order.status === 'rejected' || order.status === 'cancelled') ? (
                    getStatusIcon(step.status)
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Step Line */}
                {index < workflowSteps.length - 1 && (
                  <div className={`w-full h-0.5 mt-2 ${
                    index < currentStepIndex ? 'bg-blue-500' : 'bg-gray-300'
                  }`} />
                )}

                {/* Step Label */}
                <div className="mt-2 text-center">
                  <div className={`text-xs font-medium ${
                    index <= currentStepIndex ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 max-w-20 text-center">
                    {step.description}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Special Status Indicators */}
          {(order.status === 'rejected' || order.status === 'cancelled' || order.status === 'cancellation_requested') && (
            <div className={`mt-4 p-3 rounded-lg border ${getStatusColor(order.status)}`}>
              <div className="flex items-center">
                {getStatusIcon(order.status)}
                <span className="ml-2 font-medium">
                  {order.status === 'rejected' && 'Order Rejected'}
                  {order.status === 'cancelled' && 'Order Cancelled'}
                  {order.status === 'cancellation_requested' && 'Cancellation Requested'}
                </span>
              </div>
              {(order.rejectionReason || order.cancellationReason) && (
                <div className="mt-2 text-sm">
                  <strong>Reason:</strong> {order.rejectionReason || order.cancellationReason}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status Transition Controls */}
      {canTransition && (
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900">Available Actions</h4>
            {!showTransitionForm && (
              <button
                onClick={() => setShowTransitionForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                Update Status
              </button>
            )}
          </div>

          {/* Quick Action Buttons */}
          {!showTransitionForm && (
            <div className="flex flex-wrap gap-2">
              {allowedNextStatuses.map(status => (
                <button
                  key={status}
                  onClick={() => {
                    setTransitionForm(prev => ({ ...prev, targetStatus: status }));
                    setShowTransitionForm(true);
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium border hover:opacity-80 transition-opacity ${
                    status === 'approved' ? 'bg-green-100 text-green-800 border-green-200' :
                    status === 'rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                    status === 'processing' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                    status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' :
                    status === 'cancelled' ? 'bg-gray-100 text-gray-800 border-gray-200' :
                    'bg-blue-100 text-blue-800 border-blue-200'
                  }`}
                >
                  {status.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}

          {/* Transition Form */}
          {showTransitionForm && (
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Status
                </label>
                <select
                  value={transitionForm.targetStatus}
                  onChange={(e) => setTransitionForm(prev => ({
                    ...prev,
                    targetStatus: e.target.value as OrderStatus
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value={order.status}>Keep Current Status</option>
                  {allowedNextStatuses.map(status => (
                    <option key={status} value={status}>
                      {status.replace('_', ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={transitionForm.priority}
                    onChange={(e) => setTransitionForm(prev => ({
                      ...prev,
                      priority: e.target.value as any
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={transitionForm.reason}
                    onChange={(e) => setTransitionForm(prev => ({
                      ...prev,
                      reason: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Reason for status change"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={transitionForm.notes}
                  onChange={(e) => setTransitionForm(prev => ({
                    ...prev,
                    notes: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes about this status change"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowTransitionForm(false);
                    setError(null);
                  }}
                  disabled={loading}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStatusTransition}
                  disabled={loading || transitionForm.targetStatus === order.status}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Update Status'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Tasks */}
      {activeTasks.length > 0 && (
        <div className="p-6 border-b border-gray-200">
          <h4 className="font-medium text-gray-900 mb-4">Active Workflow Tasks</h4>
          <div className="space-y-3">
            {activeTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    task.status === 'executing' ? 'bg-blue-500 animate-pulse' :
                    task.status === 'pending' ? 'bg-yellow-500' :
                    task.status === 'completed' ? 'bg-green-500' :
                    'bg-red-500'
                  }`} />
                  <div>
                    <div className="text-sm font-medium">{task.action.replace('_', ' ')}</div>
                    <div className="text-xs text-gray-500">
                      {task.status} • Priority: {task.priority}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {task.retryCount > 0 && `Retry ${task.retryCount}/${task.maxRetries}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Timeline */}
      <div className="p-6">
        <h4 className="font-medium text-gray-900 mb-4">Order Timeline</h4>
        <div className="space-y-4">
          {order.workflowHistory && order.workflowHistory.length > 0 ? (
            order.workflowHistory
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map((action, index) => (
                <div key={index} className="flex items-start">
                  <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 mr-3 ${
                    action.action === 'approve' ? 'bg-green-500' :
                    action.action === 'reject' ? 'bg-red-500' :
                    action.action === 'complete' ? 'bg-green-500' :
                    action.action === 'cancel' ? 'bg-gray-500' :
                    'bg-blue-500'
                  }`} />
                  <div className="flex-grow">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">
                        {action.action.replace('_', ' ').toUpperCase()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(action.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {action.previousStatus} → {action.newStatus}
                    </div>
                    {action.notes && (
                      <div className="text-sm text-gray-500 mt-1">
                        {action.notes}
                      </div>
                    )}
                    {action.reason && (
                      <div className="text-sm text-gray-500 italic">
                        Reason: {action.reason}
                      </div>
                    )}
                  </div>
                </div>
              ))
          ) : (
            <div className="text-center text-gray-500 py-4">
              No workflow history available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderStatusWorkflow; 