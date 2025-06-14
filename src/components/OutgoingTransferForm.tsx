'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Order, 
  OrderType, 
  OrderPriority, 
  CommissionRate, 
  FormErrors
} from '@/types';
import { 
  validateJordanianMobile, 
  formatJordanianMobile, 
  calculateCommission, 
  calculateNetAmount,
  createOrder
} from '@/lib/orderOperations';
import { useAuth } from '@/contexts/AuthContext';

interface OutgoingTransferFormProps {
  onOrderCreated: (orderId: string) => void;
  onCancel: () => void;
  userCommissionRate: CommissionRate;
}

interface OutgoingTransferData {
  amount: string;
  cliqType: 'alias' | 'mobile';
  aliasName: string;
  mobileNumber: string;
  recipientName: string;
  recipientBank: string;
  notes: string;
  priority: OrderPriority;
}

const OutgoingTransferForm: React.FC<OutgoingTransferFormProps> = ({
  onOrderCreated,
  onCancel,
  userCommissionRate
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState<OutgoingTransferData>({
    amount: '',
    cliqType: 'mobile',
    aliasName: '',
    mobileNumber: '',
    recipientName: '',
    recipientBank: '',
    notes: '',
    priority: 'normal'
  });

  // Jordanian banks and digital wallets
  const recipientBankOptions = [
    // Major Jordanian Banks
    { value: 'arab-bank', label: 'Arab Bank' },
    { value: 'jordan-bank', label: 'Bank of Jordan' },
    { value: 'housing-bank', label: 'Housing Bank for Trade and Finance' },
    { value: 'jordan-islamic-bank', label: 'Jordan Islamic Bank' },
    { value: 'cairo-amman-bank', label: 'Cairo Amman Bank' },
    { value: 'union-bank', label: 'Union Bank' },
    { value: 'societe-generale', label: 'Société Générale de Banque - Jordanie' },
    { value: 'capital-bank', label: 'Capital Bank of Jordan' },
    { value: 'investbank', label: 'Investbank' },
    { value: 'ahli-bank', label: 'Jordan Ahli Bank' },
    { value: 'safwa-bank', label: 'Safwa Islamic Bank' },
    { value: 'jordan-commercial-bank', label: 'Jordan Commercial Bank' },
    { value: 'abc-bank', label: 'Arab Banking Corporation (Jordan)' },
    { value: 'blom-bank', label: 'BLOM Bank Jordan' },
    { value: 'al-etihad-bank', label: 'Al-Etihad and Development Bank' },
    // Digital Wallets
    { value: 'zain-cash', label: 'Zain Cash' },
    { value: 'orange-money', label: 'Orange Money' },
    { value: 'uwallet', label: 'UWallet' },
    { value: 'dinarak', label: 'Dinarak' }
  ];

  // Real-time commission calculation
  const [commissionAmount, setCommissionAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    const amount = parseFloat(formData.amount) || 0;
    if (amount > 0 && userCommissionRate) {
      const commission = calculateCommission(amount, userCommissionRate) || 0;
      setCommissionAmount(commission);
      setTotalAmount(amount + commission);
    } else {
      setCommissionAmount(0);
      setTotalAmount(0);
    }
  }, [formData.amount, userCommissionRate]);

  const handleInputChange = useCallback((field: keyof OutgoingTransferData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific errors
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Format mobile number on change
    if (field === 'mobileNumber' && value) {
      const formatted = formatJordanianMobile(value);
      if (formatted !== value) {
        setFormData(prev => ({ ...prev, mobileNumber: formatted }));
      }
    }
  }, [errors]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Amount validation
    const amount = parseFloat(formData.amount);
    if (!formData.amount) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(amount) || amount <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    } else if (amount < 1) {
      newErrors.amount = 'Minimum amount is 1 JOD';
    } else if (amount > 10000) {
      newErrors.amount = 'Maximum amount is 10,000 JOD';
    }

    // CliQ details validation
    if (formData.cliqType === 'alias') {
      if (!formData.aliasName.trim()) {
        newErrors.aliasName = 'Alias name is required';
      } else if (formData.aliasName.length < 3) {
        newErrors.aliasName = 'Alias name must be at least 3 characters';
      } else if (formData.aliasName.length > 50) {
        newErrors.aliasName = 'Alias name must be less than 50 characters';
      }
    } else {
      if (!formData.mobileNumber.trim()) {
        newErrors.mobileNumber = 'Mobile number is required';
      } else if (!validateJordanianMobile(formData.mobileNumber)) {
        newErrors.mobileNumber = 'Please enter a valid Jordanian mobile number';
      }
    }

    // Optional fields validation
    if (formData.recipientName && formData.recipientName.length > 100) {
      newErrors.recipientName = 'Recipient name must be less than 100 characters';
    }
    
    if (formData.recipientBank && formData.recipientBank.length > 100) {
      newErrors.recipientBank = 'Bank name must be less than 100 characters';
    }

    if (formData.notes && formData.notes.length > 500) {
      newErrors.notes = 'Notes must be less than 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !user || !userCommissionRate) return;

    setLoading(true);
    try {
      const amount = parseFloat(formData.amount);
      // Ensure commission is never undefined
      const commission = calculateCommission(amount, userCommissionRate) || 0;
      
      // Build cliqDetails object without undefined values
      const cliqDetails: { aliasName?: string; mobileNumber?: string; description?: string } = {};
      if (formData.cliqType === 'alias' && formData.aliasName) {
        cliqDetails.aliasName = formData.aliasName;
      }
      if (formData.cliqType === 'mobile' && formData.mobileNumber) {
        cliqDetails.mobileNumber = formData.mobileNumber;
      }

      // Build recipientDetails object without undefined values
      const recipientDetails: { name?: string; bankName?: string; accountNumber?: string; notes?: string } = {};
      if (formData.recipientName) {
        recipientDetails.name = formData.recipientName;
      }
      if (formData.recipientBank) {
        recipientDetails.bankName = formData.recipientBank;
      }
      if (formData.notes) {
        recipientDetails.notes = formData.notes;
      }

      const orderData: Omit<Order, 'id' | 'orderId' | 'workflowHistory' | 'timestamps'> = {
        exchangeId: user.id,
        type: 'outgoing' as OrderType,
        status: 'submitted',
        priority: formData.priority,
        submittedAmount: amount,
        commission,
        commissionRate: userCommissionRate,
        netAmount: calculateNetAmount(amount, commission, 'outgoing'),
        cliqDetails,
        recipientDetails,
        screenshots: [],
        documents: [],
        source: 'web',
        tags: ['outgoing', 'cliq'],
        isBeingEdited: false
      };

      const orderId = await createOrder(orderData);
      onOrderCreated(orderId);
    } catch (error) {
      console.error('Error creating outgoing transfer:', error);
      setErrors({ submit: 'Failed to create transfer. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Platform bank will be selected by admin later

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">New Outgoing Transfer</h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 p-2"
          aria-label="Close form"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Amount Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
              Amount (JOD) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                id="amount"
                step="0.01"
                min="0"
                max="10000"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.amount ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0.00"
                disabled={loading}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-gray-500 text-sm">JOD</span>
              </div>
            </div>
            {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount}</p>}
          </div>

          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => handleInputChange('priority', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            >
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Commission Display */}
        {formData.amount && !isNaN(parseFloat(formData.amount)) && parseFloat(formData.amount) > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Amount:</span>
                <div className="font-medium">{(parseFloat(formData.amount) || 0).toFixed(2)} JOD</div>
              </div>
              <div>
                <span className="text-gray-600">Commission:</span>
                <div className="font-medium">
                  {(commissionAmount || 0).toFixed(2)} JOD
                  <span className="text-xs text-gray-500 ml-1">
                    ({userCommissionRate?.type === 'percentage' ? `${userCommissionRate.value}%` : 'Fixed'})
                  </span>
                </div>
              </div>
              <div>
                <span className="text-gray-600">Total Cost:</span>
                <div className="font-medium text-blue-600">{(totalAmount || 0).toFixed(2)} JOD</div>
              </div>
            </div>
          </div>
        )}

        {/* CliQ Details Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">CliQ Payment Details</h3>
          
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="cliqType"
                value="mobile"
                checked={formData.cliqType === 'mobile'}
                onChange={(e) => handleInputChange('cliqType', e.target.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                disabled={loading}
              />
              <span className="ml-2 text-sm text-gray-700">Mobile Number</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="cliqType"
                value="alias"
                checked={formData.cliqType === 'alias'}
                onChange={(e) => handleInputChange('cliqType', e.target.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                disabled={loading}
              />
              <span className="ml-2 text-sm text-gray-700">Alias Name</span>
            </label>
          </div>

          {formData.cliqType === 'mobile' ? (
            <div>
              <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 mb-2">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="mobileNumber"
                value={formData.mobileNumber}
                onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.mobileNumber ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="079XXXXXXX or +962 79 XXX XXXX"
                disabled={loading}
              />
              {errors.mobileNumber && <p className="mt-1 text-sm text-red-600">{errors.mobileNumber}</p>}
              <p className="mt-1 text-xs text-gray-500">
                Enter Jordanian mobile number (077, 078, or 079)
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="aliasName" className="block text-sm font-medium text-gray-700 mb-2">
                Alias Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="aliasName"
                value={formData.aliasName}
                onChange={(e) => handleInputChange('aliasName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.aliasName ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter CliQ alias name"
                disabled={loading}
              />
              {errors.aliasName && <p className="mt-1 text-sm text-red-600">{errors.aliasName}</p>}
            </div>
          )}
        </div>

        {/* Recipient Details (Optional) */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Recipient Details (Optional)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="recipientName" className="block text-sm font-medium text-gray-700 mb-2">
                Recipient Name
              </label>
              <input
                type="text"
                id="recipientName"
                value={formData.recipientName}
                onChange={(e) => handleInputChange('recipientName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.recipientName ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Recipient's full name"
                maxLength={100}
                disabled={loading}
              />
              {errors.recipientName && <p className="mt-1 text-sm text-red-600">{errors.recipientName}</p>}
            </div>

            <div>
              <label htmlFor="recipientBank" className="block text-sm font-medium text-gray-700 mb-2">
                Recipient Bank
              </label>
              <select
                id="recipientBank"
                value={formData.recipientBank}
                onChange={(e) => handleInputChange('recipientBank', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.recipientBank ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={loading}
              >
                <option value="">Select recipient bank (optional)</option>
                {recipientBankOptions.map(bank => (
                  <option key={bank.value} value={bank.value}>
                    {bank.label}
                  </option>
                ))}
              </select>
              {errors.recipientBank && <p className="mt-1 text-sm text-red-600">{errors.recipientBank}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.notes ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Any additional notes or instructions"
              maxLength={500}
              disabled={loading}
            />
            {errors.notes && <p className="mt-1 text-sm text-red-600">{errors.notes}</p>}
            <div className="mt-1 text-xs text-gray-500 text-right">
              {formData.notes.length}/500 characters
            </div>
          </div>
        </div>

        {/* Error Message */}
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{errors.submit}</p>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6">
          <button
            type="submit"
            disabled={loading || !formData.amount || !(formData.aliasName || formData.mobileNumber)}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Transfer...
              </span>
            ) : (
              'Create Outgoing Transfer'
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 sm:flex-none bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default OutgoingTransferForm; 