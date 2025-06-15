'use client';

import React, { useState, useEffect } from 'react';
import {
  Order,
  OrderStatus,
  OrderFile
} from '@/types';
import { updateOrderStatus, getNextAllowedStatuses } from '@/lib/orderOperations';
import EnhancedFileUpload from './EnhancedFileUpload';

interface OrderStatusWorkflowProps {
  order: Order;
  onOrderUpdated: (order: Order) => void;
  userRole: 'admin' | 'exchange';
  className?: string;
}

// Mock platform banks - replace with actual data from Firebase
const PLATFORM_BANKS = [
  { id: 'bank1', name: 'Arab Bank', accountNumber: '**** 1234' },
  { id: 'bank2', name: 'Cairo Amman Bank', accountNumber: '**** 5678' },
  { id: 'bank3', name: 'Jordan Kuwait Bank', accountNumber: '**** 9012' },
];

const OrderStatusWorkflow: React.FC<OrderStatusWorkflowProps> = ({
  order,
  onOrderUpdated,
  userRole,
  className = ''
}) => {
  const [loading, setLoading] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionData, setCompletionData] = useState({
    screenshots: [] as OrderFile[],
    platformBank: '',
    notes: ''
  });

  // Handle status update actions
  const handleStatusUpdate = async (newStatus: OrderStatus, notes?: string) => {
    if (!order || loading) return;

    // For completing outgoing orders, show completion modal
    if (newStatus === 'completed' && order.type === 'outgoing') {
      setShowCompletionModal(true);
      return;
    }

    setLoading(true);

    try {
      const success = await updateOrderStatus(
        order.orderId,
        newStatus,
        'admin',
        userRole,
        notes && notes.trim() ? notes.trim() : undefined
      );

      if (success) {
        const updatedOrder = {
          ...order,
          status: newStatus,
          timestamps: {
            ...order.timestamps,
            updated: new Date(),
            [newStatus]: new Date()
          }
        };
        onOrderUpdated(updatedOrder);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload completion
  const handleFileUploadComplete = (urls: string[]) => {
    // Convert URLs to OrderFile objects for consistency
    const screenshots: OrderFile[] = urls.map((url, index) => ({
      id: `temp-${Date.now()}-${index}`,
      fileName: `payment-proof-${Date.now()}-${index}`,
      originalName: `payment-proof-${Date.now()}-${index}.jpg`,
      fileType: 'image/jpeg',
      fileSize: 0, // Size not available from URL
      url,
      uploadedBy: 'admin',
      uploadedByRole: 'admin' as const,
      uploadedAt: new Date(),
      category: 'receipt' as const,
      isRequired: true,
      status: 'uploaded' as const
    }));
    
    setCompletionData({
      ...completionData,
      screenshots
    });
  };

  // Handle outgoing order completion with screenshot and platform bank
  const handleCompleteOutgoing = async () => {
    if (completionData.screenshots.length === 0 || !completionData.platformBank) {
      alert('Please upload payment proof and select platform bank');
      return;
    }

    setLoading(true);

    try {
      // TODO: Update order with platform bank information and screenshot URLs
      
      const success = await updateOrderStatus(
        order.orderId,
        'completed',
        'admin',
        userRole,
        completionData.notes.trim() || undefined
      );

      if (success) {
        const updatedOrder = {
          ...order,
          status: 'completed' as OrderStatus,
          platformBankUsed: completionData.platformBank,
          screenshots: [...order.screenshots, ...completionData.screenshots],
          timestamps: {
            ...order.timestamps,
            updated: new Date(),
            completed: new Date()
          }
        };
        onOrderUpdated(updatedOrder);
        setShowCompletionModal(false);
        setCompletionData({ screenshots: [], platformBank: '', notes: '' });
        // Re-enable body scroll
        document.body.classList.remove('modal-open');
      }
    } catch (error) {
      console.error('Error completing order:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add effect to handle modal opening/closing
  useEffect(() => {
    if (showCompletionModal) {
      // Prevent body scroll when modal opens
      document.body.classList.add('modal-open');
    } else {
      // Re-enable body scroll when modal closes
      document.body.classList.remove('modal-open');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showCompletionModal]);

  // Get allowed next statuses for this order
  const allowedStatuses = getNextAllowedStatuses(order.status, userRole);

  // Get action buttons
  const getActionButtons = () => {
    if (userRole !== 'admin' || allowedStatuses.length === 0) return null;

    return allowedStatuses.map(status => {
      const getButtonConfig = (status: OrderStatus): { label: string; color: string; icon: string } => {
        switch (status) {
          case 'processing':
            return {
              label: 'Approve & Process',
              color: 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md hover:shadow-lg transform hover:scale-105',
              icon: '✓'
            };
          case 'completed':
            return {
              label: order.type === 'outgoing' ? 'Complete Order' : 'Mark Completed',
              color: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transform hover:scale-105',
              icon: '🎯'
            };
          case 'rejected':
            return {
              label: 'Reject Order',
              color: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-md hover:shadow-lg transform hover:scale-105',
              icon: '✕'
            };
          case 'cancelled':
            return {
              label: 'Cancel Order',
              color: 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white shadow-md hover:shadow-lg transform hover:scale-105',
              icon: '🚫'
            };
          default:
            return {
              label: status.replace('_', ' ').toUpperCase(),
              color: 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white shadow-md hover:shadow-lg transform hover:scale-105',
              icon: '⚡'
            };
        }
      };

      const config = getButtonConfig(status);
      return (
        <button
          key={status}
          onClick={() => handleStatusUpdate(status)}
          disabled={loading}
          className={`w-full px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${config.color}`}
        >
          <div className="flex items-center justify-center space-x-2">
            {loading ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span className="text-lg">{config.icon}</span>
            )}
            <span>{config.label}</span>
          </div>
        </button>
      );
    });
  };

  const actionButtons = getActionButtons();

  return (
    <>
      <div className={`${className}`}>
        {/* Action Buttons - Enhanced Mobile-First Layout */}
        {actionButtons && actionButtons.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Quick Actions
              </h4>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
            
            {/* Primary Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {actionButtons}
            </div>
            
            {/* Action Helper Text */}
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="flex items-start space-x-2">
                <svg className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium text-gray-600">Status: {order.status.replace('_', ' ').toUpperCase()}</p>
                  <p className="text-gray-500 mt-1">
                    {order.status === 'submitted' && 'Review and approve this order to begin processing.'}
                    {order.status === 'processing' && 'Order is being processed. Complete when payment is sent.'}
                    {order.status === 'completed' && 'Order has been successfully completed.'}
                    {order.status === 'rejected' && 'Order was rejected and cannot be processed.'}
                    {order.status === 'cancelled' && 'Order was cancelled and will not be processed.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Outgoing Order Completion Modal - Mobile Optimized & Scrollable */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-md sm:w-full h-[90vh] sm:max-h-[85vh] flex flex-col">
            {/* Header - Fixed */}
            <div className="flex-shrink-0 p-4 sm:p-6 border-b border-gray-200 bg-white rounded-t-2xl sm:rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Complete Outgoing Order
                </h3>
                <button
                  onClick={() => {
                    setShowCompletionModal(false);
                    document.body.classList.remove('modal-open');
                  }}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Progress Indicator */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 font-medium">
                    Progress: {completionData.screenshots.length > 0 && completionData.platformBank ? '2/2' : 
                              completionData.screenshots.length > 0 || completionData.platformBank ? '1/2' : '0/2'} completed
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    completionData.screenshots.length > 0 && completionData.platformBank 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {completionData.screenshots.length > 0 && completionData.platformBank ? 'Ready to Submit' : 'Missing Required Fields'}
                  </span>
                </div>
              </div>
            </div>

            {/* Content - Fully Scrollable with proper constraints */}
            <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y modal-scroll">
              <div className="p-4 sm:p-6 pb-6">
                <div className="space-y-6">
                  {/* Payment Proof Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Proof Screenshot *
                      {completionData.screenshots.length > 0 && (
                        <span className="ml-2 text-green-600 text-xs">✓ Uploaded</span>
                      )}
                    </label>
                    <EnhancedFileUpload
                      orderId={order.orderId}
                      maxFiles={1}
                      onUploadComplete={handleFileUploadComplete}
                      className="border-2 border-dashed border-gray-300 rounded-lg"
                    />
                  </div>

                  {/* Platform Bank Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Platform Bank Used *
                      {completionData.platformBank && (
                        <span className="ml-2 text-green-600 text-xs">✓ Selected</span>
                      )}
                    </label>
                    <select
                      value={completionData.platformBank}
                      onChange={(e) => setCompletionData({
                        ...completionData,
                        platformBank: e.target.value
                      })}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-3"
                    >
                      <option value="">Select platform bank...</option>
                      {PLATFORM_BANKS.map(bank => (
                        <option key={bank.id} value={bank.id}>
                          {bank.name} ({bank.accountNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={completionData.notes}
                      onChange={(e) => setCompletionData({
                        ...completionData,
                        notes: e.target.value
                      })}
                      rows={3}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Any additional notes..."
                    />
                  </div>

                  {/* Requirements Checklist */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Required to Complete:</h4>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <div className={`w-4 h-4 rounded-full mr-3 ${
                          completionData.screenshots.length > 0 ? 'bg-green-500' : 'bg-gray-300'
                        }`}>
                          {completionData.screenshots.length > 0 && (
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm ${
                          completionData.screenshots.length > 0 ? 'text-green-700' : 'text-gray-600'
                        }`}>
                          Upload payment proof screenshot
                        </span>
                      </div>
                      <div className="flex items-center">
                        <div className={`w-4 h-4 rounded-full mr-3 ${
                          completionData.platformBank ? 'bg-green-500' : 'bg-gray-300'
                        }`}>
                          {completionData.platformBank && (
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm ${
                          completionData.platformBank ? 'text-green-700' : 'text-gray-600'
                        }`}>
                          Select platform bank used for payment
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Extra spacing for better scrolling */}
                  <div className="h-4"></div>
                </div>
              </div>
            </div>

            {/* Footer - Fixed/Sticky */}
            <div className="flex-shrink-0 p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setShowCompletionModal(false);
                    document.body.classList.remove('modal-open');
                  }}
                  disabled={loading}
                  className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteOutgoing}
                  disabled={loading || completionData.screenshots.length === 0 || !completionData.platformBank}
                  className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                      Completing Order...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <span>Complete Order</span>
                      {completionData.screenshots.length > 0 && completionData.platformBank && (
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      )}
                    </div>
                  )}
                </button>
              </div>
              
              {/* Button Help Text */}
              {(completionData.screenshots.length === 0 || !completionData.platformBank) && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Complete the required fields above to enable the submit button
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OrderStatusWorkflow; 