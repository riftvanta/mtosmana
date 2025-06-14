'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Order, 
  OrderType, 
  OrderPriority, 
  CommissionRate, 
  User,
  FormErrors,
  BankAssignment,
  PlatformBank,
  OrderFile,
  FileUpload
} from '@/types';
import { 
  calculateCommission, 
  calculateNetAmount,
  createOrder,
  addOrderFile
} from '@/lib/orderOperations';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFile } from '@/lib/firebase-storage';

interface IncomingTransferFormProps {
  onOrderCreated: (orderId: string) => void;
  onCancel: () => void;
  userCommissionRate: CommissionRate;
  assignedBanks: (BankAssignment & { bank: PlatformBank })[];
}

interface IncomingTransferData {
  amount: string;
  senderName: string;
  senderBank: string;
  reference: string;
  bankId: string;
  notes: string;
  priority: OrderPriority;
}

const IncomingTransferForm: React.FC<IncomingTransferFormProps> = ({
  onOrderCreated,
  onCancel,
  userCommissionRate,
  assignedBanks
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState<IncomingTransferData>({
    amount: '',
    senderName: '',
    senderBank: '',
    reference: '',
    bankId: '',
    notes: '',
    priority: 'normal'
  });

  // File upload state
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Real-time commission calculation
  const [commissionAmount, setCommissionAmount] = useState(0);
  const [netAmount, setNetAmount] = useState(0);

  useEffect(() => {
    const amount = parseFloat(formData.amount) || 0;
    if (amount > 0) {
      const commission = calculateCommission(amount, userCommissionRate);
      setCommissionAmount(commission);
      setNetAmount(calculateNetAmount(amount, commission, 'incoming'));
    } else {
      setCommissionAmount(0);
      setNetAmount(0);
    }
  }, [formData.amount, userCommissionRate]);

  const handleInputChange = useCallback((field: keyof IncomingTransferData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific errors
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
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
    } else if (amount > 50000) {
      newErrors.amount = 'Maximum amount is 50,000 JOD';
    }

    // Bank selection validation
    if (!formData.bankId) {
      newErrors.bankId = 'Please select a bank';
    }

    // Screenshot validation - at least one required
    const uploadedFiles = files.filter(f => f.status === 'completed');
    if (uploadedFiles.length === 0) {
      newErrors.screenshots = 'At least one payment proof screenshot is required';
    }

    // Optional fields validation
    if (formData.senderName && formData.senderName.length > 100) {
      newErrors.senderName = 'Sender name must be less than 100 characters';
    }
    
    if (formData.senderBank && formData.senderBank.length > 100) {
      newErrors.senderBank = 'Bank name must be less than 100 characters';
    }

    if (formData.notes && formData.notes.length > 500) {
      newErrors.notes = 'Notes must be less than 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, files]);

  const handleFileSelect = useCallback((selectedFiles: FileList | null, source: 'gallery' | 'camera') => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: FileUpload[] = [];
    Array.from(selectedFiles).forEach((file, index) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, [`file_${index}`]: 'Only image files are allowed' }));
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, [`file_${index}`]: 'File size must be less than 5MB' }));
        return;
      }

      const fileUpload: FileUpload = {
        file,
        progress: 0,
        status: 'pending',
        id: `${Date.now()}_${index}`,
        category: 'screenshot'
      };

      newFiles.push(fileUpload);
    });

    setFiles(prev => [...prev, ...newFiles]);
    
    // Start uploading files
    newFiles.forEach(uploadFile);
  }, []);

  const uploadFile = useCallback(async (fileUpload: FileUpload) => {
    if (!user || !fileUpload.id) return;

    setUploadingFiles(prev => [...prev, fileUpload.id!]);
    
    try {
      // Update status to uploading
      setFiles(prev => prev.map(f => 
        f.id === fileUpload.id ? { ...f, status: 'uploading' } : f
      ));

      // Upload to Firebase Storage
      const downloadURL = await uploadFile(fileUpload.file, `orders/screenshots/${user.id}`, {
        onProgress: (progress) => {
          setFiles(prev => prev.map(f => 
            f.id === fileUpload.id ? { ...f, progress } : f
          ));
        }
      });

      // Update status to completed
      setFiles(prev => prev.map(f => 
        f.id === fileUpload.id ? { 
          ...f, 
          status: 'completed', 
          url: downloadURL,
          progress: 100
        } : f
      ));

    } catch (error) {
      console.error('Error uploading file:', error);
      setFiles(prev => prev.map(f => 
        f.id === fileUpload.id ? { 
          ...f, 
          status: 'error', 
          error: 'Upload failed. Please try again.'
        } : f
      ));
    } finally {
      setUploadingFiles(prev => prev.filter(id => id !== fileUpload.id));
    }
  }, [user]);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadingFiles(prev => prev.filter(id => id !== fileId));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !user) return;

    setLoading(true);
    try {
      const amount = parseFloat(formData.amount);
      const commission = calculateCommission(amount, userCommissionRate);
      const finalAmount = calculateNetAmount(amount, commission, 'incoming');
      
      // Prepare order files
      const orderFiles: OrderFile[] = files
        .filter(f => f.status === 'completed' && f.url)
        .map(f => ({
          id: f.id!,
          fileName: `${Date.now()}_${f.file.name}`,
          originalName: f.file.name,
          fileType: f.file.type,
          fileSize: f.file.size,
          url: f.url!,
          uploadedBy: user.id,
          uploadedByRole: 'exchange',
          uploadedAt: new Date(),
          category: 'screenshot',
          isRequired: true,
          status: 'uploaded'
        }));

      const orderData: Omit<Order, 'id' | 'orderId' | 'workflowHistory' | 'timestamps'> = {
        exchangeId: user.id,
        type: 'incoming' as OrderType,
        status: 'submitted',
        priority: formData.priority,
        submittedAmount: amount,
        finalAmount,
        commission,
        commissionRate: userCommissionRate,
        netAmount: finalAmount,
        senderDetails: {
          name: formData.senderName || undefined,
          bankName: formData.senderBank || undefined,
          reference: formData.reference || undefined
        },
        bankUsed: formData.bankId,
        screenshots: orderFiles,
        documents: [],
        adminNotes: formData.notes || undefined,
        source: 'web',
        tags: ['incoming', 'screenshot-verified'],
        isBeingEdited: false
      };

      const orderId = await createOrder(orderData);
      onOrderCreated(orderId);
    } catch (error) {
      console.error('Error creating incoming transfer:', error);
      setErrors({ submit: 'Failed to create transfer. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const selectedBank = assignedBanks.find(assignment => assignment.bankId === formData.bankId);

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">New Incoming Transfer</h2>
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
              Received Amount (JOD) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                id="amount"
                step="0.01"
                min="0"
                max="50000"
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
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Commission Display */}
        {formData.amount && (
          <div className="bg-green-50 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Received Amount:</span>
                <div className="font-medium">{parseFloat(formData.amount).toFixed(2)} JOD</div>
              </div>
              <div>
                <span className="text-gray-600">Commission:</span>
                <div className="font-medium">
                  {commissionAmount.toFixed(2)} JOD
                  <span className="text-xs text-gray-500 ml-1">
                    ({userCommissionRate.type === 'percentage' ? `${userCommissionRate.value}%` : 'Fixed'})
                  </span>
                </div>
              </div>
              <div>
                <span className="text-gray-600">Net Amount:</span>
                <div className="font-medium text-green-600">{netAmount.toFixed(2)} JOD</div>
              </div>
            </div>
          </div>
        )}

        {/* Bank Selection */}
        <div>
          <label htmlFor="bankId" className="block text-sm font-medium text-gray-700 mb-2">
            Bank Received From <span className="text-red-500">*</span>
          </label>
          <select
            id="bankId"
            value={formData.bankId}
            onChange={(e) => handleInputChange('bankId', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.bankId ? 'border-red-300' : 'border-gray-300'
            }`}
            disabled={loading}
          >
            <option value="">Select bank</option>
            {assignedBanks
              .filter(assignment => assignment.isActive && assignment.bank.isActive)
              .sort((a, b) => a.priority - b.priority)
              .map(assignment => (
                <option key={assignment.id} value={assignment.bankId}>
                  {assignment.bank.name} - {assignment.bank.accountHolder}
                  {assignment.assignmentType === 'private' && ' (Private)'}
                </option>
              ))}
          </select>
          {errors.bankId && <p className="mt-1 text-sm text-red-600">{errors.bankId}</p>}
          
          {selectedBank && (
            <div className="mt-2 p-3 bg-blue-50 rounded-md">
              <div className="text-sm">
                <div className="font-medium">{selectedBank.bank.name}</div>
                <div className="text-gray-600">Account: {selectedBank.bank.accountHolder}</div>
                <div className="text-gray-600">
                  {selectedBank.bank.cliqDetails.type === 'alias' ? 'Alias' : 'Mobile'}: {selectedBank.bank.cliqDetails.value}
                </div>
                <div className="text-gray-600">
                  Assignment: {selectedBank.assignmentType === 'private' ? 'Private' : 'Shared'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Payment Proof Screenshots */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">
            Payment Proof Screenshots <span className="text-red-500">*</span>
          </h3>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center px-4 py-2 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Take Photo
            </button>
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center px-4 py-2 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Choose from Gallery
            </button>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(e) => handleFileSelect(e.target.files, 'camera')}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileSelect(e.target.files, 'gallery')}
            className="hidden"
          />

          {/* File previews */}
          {files.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {files.map((file) => (
                <div key={file.id} className="relative border rounded-lg overflow-hidden">
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    {file.status === 'completed' && file.url ? (
                      <img
                        src={file.url}
                        alt={file.file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <svg className="w-8 h-8 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div className="text-xs text-gray-500 mt-1">{file.file.name}</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Upload progress */}
                  {file.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <div className="text-white text-center">
                        <div className="text-sm">{file.progress}%</div>
                        <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${file.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Status indicators */}
                  {file.status === 'error' && (
                    <div className="absolute inset-0 bg-red-500 bg-opacity-75 flex items-center justify-center">
                      <div className="text-white text-center">
                        <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-xs mt-1">Failed</div>
                      </div>
                    </div>
                  )}
                  
                  {file.status === 'completed' && (
                    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeFile(file.id!)}
                    className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    disabled={loading}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {errors.screenshots && <p className="text-sm text-red-600">{errors.screenshots}</p>}
          
          <p className="text-xs text-gray-500">
            Upload screenshots of the payment confirmation. Supported formats: JPG, PNG. Max size: 5MB per file.
          </p>
        </div>

        {/* Sender Details (Optional) */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Sender Details (Optional)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="senderName" className="block text-sm font-medium text-gray-700 mb-2">
                Sender Name
              </label>
              <input
                type="text"
                id="senderName"
                value={formData.senderName}
                onChange={(e) => handleInputChange('senderName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.senderName ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Name of the person who sent the money"
                maxLength={100}
                disabled={loading}
              />
              {errors.senderName && <p className="mt-1 text-sm text-red-600">{errors.senderName}</p>}
            </div>

            <div>
              <label htmlFor="senderBank" className="block text-sm font-medium text-gray-700 mb-2">
                Sender Bank
              </label>
              <input
                type="text"
                id="senderBank"
                value={formData.senderBank}
                onChange={(e) => handleInputChange('senderBank', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.senderBank ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Bank used by sender"
                maxLength={100}
                disabled={loading}
              />
              {errors.senderBank && <p className="mt-1 text-sm text-red-600">{errors.senderBank}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-2">
              Transfer Reference
            </label>
            <input
              type="text"
              id="reference"
              value={formData.reference}
              onChange={(e) => handleInputChange('reference', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Reference number or transaction ID"
              disabled={loading}
            />
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
              placeholder="Any additional information about the transfer"
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
            disabled={
              loading || 
              !formData.amount || 
              !formData.bankId || 
              files.filter(f => f.status === 'completed').length === 0 ||
              uploadingFiles.length > 0
            }
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Transfer...
              </span>
            ) : uploadingFiles.length > 0 ? (
              'Uploading Files...'
            ) : (
              'Create Incoming Transfer'
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

export default IncomingTransferForm; 