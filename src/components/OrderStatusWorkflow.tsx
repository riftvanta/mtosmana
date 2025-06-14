'use client';

import React from 'react';
import {
  Order,
  OrderStatus
} from '@/types';

interface OrderStatusWorkflowProps {
  order: Order;
  onOrderUpdated: (order: Order) => void;
  userRole: 'admin' | 'exchange';
  className?: string;
}

const OrderStatusWorkflow: React.FC<OrderStatusWorkflowProps> = ({
  order,
  className = ''
}) => {
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

  // Workflow progress visualization - dynamic based on order status
  const getWorkflowSteps = () => {
    // For cancelled orders, show the path that was taken
    if (order.status === 'cancelled') {
      return [
        { status: 'submitted', label: 'Submitted', description: 'Order has been submitted' },
        { status: 'cancelled', label: 'Cancelled', description: 'Order has been cancelled' }
      ];
    }
    
    // For rejected orders
    if (order.status === 'rejected') {
      return [
        { status: 'submitted', label: 'Submitted', description: 'Order has been submitted' },
        { status: 'rejected', label: 'Rejected', description: 'Order has been rejected' }
      ];
    }
    
    // For cancellation requested orders
    if (order.status === 'cancellation_requested') {
      return [
        { status: 'submitted', label: 'Submitted', description: 'Order has been submitted' },
        { status: 'processing', label: 'Processing', description: 'Order is being processed' },
        { status: 'cancellation_requested', label: 'Cancellation Requested', description: 'Cancellation has been requested' }
      ];
    }
    
    // For normal workflow
    return [
      { status: 'submitted', label: 'Submitted', description: 'Order has been submitted' },
      { status: 'processing', label: 'Processing', description: 'Order is approved and being processed' },
      { status: 'completed', label: 'Completed', description: 'Order has been completed' }
    ];
  };

  const workflowSteps = getWorkflowSteps();

  const getCurrentStepIndex = () => {
    const index = workflowSteps.findIndex(step => step.status === order.status);
    return index >= 0 ? index : workflowSteps.length - 1; // Default to last step if not found
  };

  const currentStepIndex = getCurrentStepIndex();

  // Check if this is a terminal state (cancelled, rejected, completed)
  const isTerminalState = ['cancelled', 'rejected', 'completed'].includes(order.status);

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
          {/* Mobile Layout */}
          <div className="block md:hidden">
            <div className="relative">
              {workflowSteps.map((step, index) => (
                <div key={step.status} className="relative flex items-center pb-6 last:pb-0">
                  {/* Vertical Line (except for last item) */}
                  {index < workflowSteps.length - 1 && (
                    <div className={`absolute left-5 top-10 w-0.5 h-6 ${
                      index < currentStepIndex ? 'bg-blue-300' : 'bg-gray-300'
                    }`}></div>
                  )}
                  
                  {/* Step Circle */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 flex-shrink-0 z-10 ${
                    index <= currentStepIndex 
                      ? isTerminalState && index === currentStepIndex && (order.status === 'cancelled' || order.status === 'rejected')
                        ? 'bg-red-500 text-white border-red-500' 
                        : 'bg-blue-500 text-white border-blue-500'
                      : 'bg-gray-100 text-gray-400 border-gray-300'
                  }`}>
                    {index <= currentStepIndex ? (
                      getStatusIcon(workflowSteps[index].status as OrderStatus)
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>

                  {/* Step Content */}
                  <div className="ml-4 flex-1">
                    <div className={`text-sm font-semibold ${
                      index <= currentStepIndex 
                        ? isTerminalState && index === currentStepIndex && (order.status === 'cancelled' || order.status === 'rejected')
                          ? 'text-red-600' 
                          : 'text-blue-600'
                        : 'text-gray-400'
                    }`}>
                      {step.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {step.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:block">
            <div className="flex items-start justify-between relative">
              {workflowSteps.map((step, index) => (
                <div key={step.status} className="flex flex-col items-center flex-1 relative">
                  {/* Step Circle */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                    index <= currentStepIndex 
                      ? isTerminalState && index === currentStepIndex && (order.status === 'cancelled' || order.status === 'rejected')
                        ? 'bg-red-500 text-white border-red-500' 
                        : 'bg-blue-500 text-white border-blue-500'
                      : 'bg-gray-100 text-gray-400 border-gray-300'
                  }`}>
                    {index <= currentStepIndex ? (
                      getStatusIcon(workflowSteps[index].status as OrderStatus)
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>

                  {/* Connecting Line */}
                  {index < workflowSteps.length - 1 && (
                    <div className={`absolute top-5 left-1/2 w-full h-0.5 ${
                      index < currentStepIndex 
                        ? 'bg-blue-300' 
                        : 'bg-gray-300'
                    }`} style={{ transform: 'translateX(50%)' }} />
                  )}

                  {/* Step Label */}
                  <div className="mt-3 text-center">
                    <div className={`text-sm font-semibold ${
                      index <= currentStepIndex 
                        ? isTerminalState && index === currentStepIndex && (order.status === 'cancelled' || order.status === 'rejected')
                          ? 'text-red-600' 
                          : 'text-blue-600'
                        : 'text-gray-400'
                    }`}>
                      {step.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 max-w-24">
                      {step.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderStatusWorkflow; 