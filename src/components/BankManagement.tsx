'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PlatformBank, BankAssignment, User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAllPlatformBanks,
  createPlatformBank,
  updatePlatformBank,
  deletePlatformBank,
  getAllBankAssignments,
  assignBankToExchange,
  removeBankAssignment,
  subscribeToPlatformBanks
} from '@/lib/bankOperations';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function BankManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'banks' | 'assignments'>('banks');
  const [banks, setBanks] = useState<PlatformBank[]>([]);
  const [assignments, setAssignments] = useState<BankAssignment[]>([]);
  const [exchanges, setExchanges] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddBank, setShowAddBank] = useState(false);
  const [showAssignBank, setShowAssignBank] = useState(false);
  const [editingBank, setEditingBank] = useState<PlatformBank | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-dismiss message functions
  const showSuccessMessage = (message: string, duration = 4000) => {
    // Clear any existing success timeout
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    
    setSuccess(message);
    setError(''); // Clear any error message
    
    // Set new timeout to clear the message
    successTimeoutRef.current = setTimeout(() => {
      setSuccess('');
      successTimeoutRef.current = null;
    }, duration);
  };

  const showErrorMessage = (message: string, duration = 6000) => {
    // Clear any existing error timeout
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    
    setError(message);
    setSuccess(''); // Clear any success message
    
    // Set new timeout to clear the message
    errorTimeoutRef.current = setTimeout(() => {
      setError('');
      errorTimeoutRef.current = null;
    }, duration);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // Form data for new/edit bank
  const [bankForm, setBankForm] = useState({
    name: '',
    cliqType: 'alias' as 'alias' | 'mobile',
    cliqValue: '',
    accountHolder: '',
    balance: 0,
    description: '',
    isActive: true
  });

  // Form data for bank assignment
  const [assignmentForm, setAssignmentForm] = useState({
    exchangeId: '',
    bankId: '',
    assignmentType: 'public' as 'private' | 'public'
  });

      const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load platform banks
      const banksResult = await getAllPlatformBanks();
      if (banksResult.success && banksResult.data) {
        setBanks(banksResult.data);
      }

      // Load bank assignments
      const assignmentsResult = await getAllBankAssignments();
      if (assignmentsResult.success && assignmentsResult.data) {
        setAssignments(assignmentsResult.data);
      }

      // Load exchanges
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'exchange'));
      const querySnapshot = await getDocs(q);
      const exchangesList: User[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        exchangesList.push({
          id: doc.id,
          username: data.username,
          password: data.password,
          role: data.role,
          exchangeName: data.exchangeName,
          contactInfo: data.contactInfo,
          balance: data.balance || 0,
          commissionRates: data.commissionRates,
          assignedBanks: data.assignedBanks || [],
          status: data.status || 'active',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });
      setExchanges(exchangesList);
    } catch (error) {
      console.error('Error loading data:', error);
      showErrorMessage('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Set up real-time listener for banks
    const unsubscribe = subscribeToPlatformBanks((updatedBanks) => {
      setBanks(updatedBanks);
    });

    return () => unsubscribe();
  }, [loadData]);

  const handleAddBank = async () => {
    if (!bankForm.name || !bankForm.cliqValue || !bankForm.accountHolder) {
      showErrorMessage('Please fill in all required fields');
      return;
    }

    setLoading(true);
    const bankData = {
      name: bankForm.name,
      cliqDetails: {
        type: bankForm.cliqType,
        value: bankForm.cliqValue
      },
      accountHolder: bankForm.accountHolder,
      balance: bankForm.balance,
      description: bankForm.description,
      isActive: bankForm.isActive,
      priority: 1
    };
    
    const result = await createPlatformBank(bankData);
    
    if (result.success) {
      showSuccessMessage('Bank added successfully');
      setShowAddBank(false);
      resetBankForm();
    } else {
      showErrorMessage(result.error || 'Failed to add bank');
    }
    setLoading(false);
  };

  const handleUpdateBank = async () => {
    if (!editingBank) return;

    setLoading(true);
    const bankData = {
      name: bankForm.name,
      cliqDetails: {
        type: bankForm.cliqType,
        value: bankForm.cliqValue
      },
      accountHolder: bankForm.accountHolder,
      balance: bankForm.balance,
      description: bankForm.description,
      isActive: bankForm.isActive,
      priority: 1
    };
    
    const result = await updatePlatformBank(editingBank.id, bankData);
    
    if (result.success) {
      showSuccessMessage('Bank updated successfully');
      setEditingBank(null);
      setShowAddBank(false); // Close the modal automatically
      resetBankForm();
    } else {
      showErrorMessage(result.error || 'Failed to update bank');
    }
    setLoading(false);
  };

  const handleDeleteBank = async (bankId: string) => {
    if (!confirm('Are you sure you want to delete this bank?')) return;

    setLoading(true);
    const result = await deletePlatformBank(bankId);
    
    if (result.success) {
      showSuccessMessage('Bank deleted successfully');
    } else {
      showErrorMessage(result.error || 'Failed to delete bank');
    }
    setLoading(false);
  };

  const handleAssignBank = async () => {
    if (!assignmentForm.exchangeId || !assignmentForm.bankId) {
      showErrorMessage('Please select both exchange and bank');
      return;
    }

    if (!user?.id) return;

    setLoading(true);
    const result = await assignBankToExchange(
      assignmentForm.exchangeId,
      assignmentForm.bankId,
      assignmentForm.assignmentType,
      user.id
    );
    
    if (result.success) {
      showSuccessMessage('Bank assigned successfully');
      setShowAssignBank(false);
      resetAssignmentForm();
      loadData(); // Reload assignments
    } else {
      showErrorMessage(result.error || 'Failed to assign bank');
    }
    setLoading(false);
  };

  const handleRemoveAssignment = async (exchangeId: string, bankId: string) => {
    if (!confirm('Are you sure you want to remove this bank assignment?')) return;

    setLoading(true);
    const result = await removeBankAssignment(exchangeId, bankId);
    
    if (result.success) {
      showSuccessMessage('Bank assignment removed');
      loadData(); // Reload assignments
    } else {
      showErrorMessage(result.error || 'Failed to remove assignment');
    }
    setLoading(false);
  };

  const resetBankForm = () => {
    setBankForm({
      name: '',
      cliqType: 'alias' as 'alias' | 'mobile',
      cliqValue: '',
      accountHolder: '',
      balance: 0,
      description: '',
      isActive: true
    });
  };

  const resetAssignmentForm = () => {
    setAssignmentForm({
      exchangeId: '',
      bankId: '',
      assignmentType: 'public'
    });
  };

  const startEditBank = (bank: PlatformBank) => {
    setEditingBank(bank);
    setBankForm({
      name: bank.name,
      cliqType: bank.cliqDetails.type,
      cliqValue: bank.cliqDetails.value,
      accountHolder: bank.accountHolder,
      balance: bank.balance,
      description: bank.description || '',
      isActive: bank.isActive
    });
    setShowAddBank(true);
  };

  const getBankName = (bankId: string) => {
    const bank = banks.find(b => b.id === bankId);
    return bank ? bank.name : 'Unknown Bank';
  };

  const getExchangeName = (exchangeId: string) => {
    const exchange = exchanges.find(e => e.id === exchangeId);
    return exchange ? (exchange.exchangeName || exchange.username) : 'Unknown Exchange';
  };

  if (loading && banks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Platform Banks & Assignments</h2>
        <p className="text-sm text-gray-600">Manage bank accounts and exchange assignments</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex">
          <button
            onClick={() => setActiveTab('banks')}
            className={`flex-1 py-3 px-2 border-b-2 font-medium text-sm text-center ${
              activeTab === 'banks'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="block sm:inline">Platform Banks</span>
            <span className="block sm:inline sm:ml-1">({banks.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`flex-1 py-3 px-2 border-b-2 font-medium text-sm text-center ${
              activeTab === 'assignments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="block sm:inline">Assignments</span>
            <span className="block sm:inline sm:ml-1">({assignments.length})</span>
          </button>
        </nav>
      </div>

      {/* Enhanced Messages with Close Buttons */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 mb-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-red-400">❌</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setError('');
                if (errorTimeoutRef.current) {
                  clearTimeout(errorTimeoutRef.current);
                  errorTimeoutRef.current = null;
                }
              }}
              className="ml-4 text-red-400 hover:text-red-600 transition-colors"
            >
              <span className="sr-only">Close</span>
              ✕
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4 mb-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-green-400">✅</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setSuccess('');
                if (successTimeoutRef.current) {
                  clearTimeout(successTimeoutRef.current);
                  successTimeoutRef.current = null;
                }
              }}
              className="ml-4 text-green-400 hover:text-green-600 transition-colors"
            >
              <span className="sr-only">Close</span>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Platform Banks Tab */}
      {activeTab === 'banks' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Platform Banks</h3>
            <button
              onClick={() => {
                setShowAddBank(true);
                setEditingBank(null);
                resetBankForm();
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add New Bank
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {banks.map((bank) => (
              <div key={bank.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{bank.name}</h4>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      bank.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {bank.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <p><span className="font-medium">CliQ {bank.cliqDetails.type}:</span> {bank.cliqDetails.value}</p>
                  <p><span className="font-medium">Holder:</span> {bank.accountHolder}</p>
                  <p><span className="font-medium">Balance:</span> {bank.balance.toLocaleString()}</p>
                  {bank.description && <p><span className="font-medium">Description:</span> {bank.description}</p>}
                </div>

                <div className="flex justify-between mt-4">
                  <button
                    onClick={() => startEditBank(bank)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteBank(bank.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bank Assignments Tab */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Bank Assignments</h3>
              <p className="text-sm text-gray-500">Manage which banks each exchange can access</p>
            </div>
            {assignments.length > 0 && (
              <button
                onClick={() => {
                  setShowAssignBank(true);
                  resetAssignmentForm();
                }}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm font-medium w-full sm:w-auto"
              >
                Assign Bank
              </button>
            )}
          </div>

          {/* Assignment Summary */}
          {assignments.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-blue-800">
                  <span className="font-medium">{assignments.length}</span> bank assignment{assignments.length !== 1 ? 's' : ''} active
                </div>
                <div className="flex items-center space-x-3 text-xs text-blue-600">
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-purple-400 rounded-full mr-1"></span>
                    {assignments.filter(a => a.assignmentType === 'private').length} Private
                  </span>
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-1"></span>
                    {assignments.filter(a => a.assignmentType === 'public').length} Public
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Mobile-First Assignment Cards */}
          {assignments.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <div className="text-4xl mb-4">🏦</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Bank Assignments</h3>
              <p className="text-gray-500 mb-4">
                Start by assigning banks to exchanges to manage their access.
              </p>
              <button
                onClick={() => {
                  setShowAssignBank(true);
                  resetAssignmentForm();
                }}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                Assign First Bank
              </button>
            </div>
          ) : (
                         <div className="space-y-3">
               {assignments.map((assignment) => (
                 <div key={assignment.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200">
                   <div className="flex items-start justify-between mb-3">
                     <div className="flex-1 min-w-0">
                       <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mb-2">
                         <h4 className="font-semibold text-gray-900 text-base truncate">
                           {getExchangeName(assignment.exchangeId)}
                         </h4>
                         <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1 sm:mt-0 self-start ${
                           assignment.assignmentType === 'private'
                             ? 'bg-purple-100 text-purple-800'
                             : 'bg-blue-100 text-blue-800'
                         }`}>
                           {assignment.assignmentType}
                         </span>
                       </div>
                       
                       <div className="space-y-1.5 text-sm">
                         <div className="flex flex-col sm:flex-row sm:items-center">
                           <span className="font-medium text-gray-700 sm:w-16">Bank:</span>
                           <span className="text-gray-900 sm:ml-2">{getBankName(assignment.bankId)}</span>
                         </div>
                         <div className="flex flex-col sm:flex-row sm:items-center">
                           <span className="font-medium text-gray-700 sm:w-16">Date:</span>
                           <span className="text-gray-600 sm:ml-2">{assignment.assignedAt.toLocaleDateString()}</span>
                         </div>
                       </div>
                     </div>
                     
                     <button
                       onClick={() => handleRemoveAssignment(assignment.exchangeId, assignment.bankId)}
                       className="ml-4 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-2 rounded-md text-sm font-medium transition-colors min-w-[80px] touch-manipulation flex-shrink-0"
                     >
                       Remove
                     </button>
                   </div>
                   
                   {/* Assignment Type Description */}
                   <div className="mt-3 pt-3 border-t border-gray-100">
                     <p className="text-xs text-gray-500 flex items-center">
                       <span className="mr-2">
                         {assignment.assignmentType === 'private' ? '🔒' : '🌐'}
                       </span>
                       {assignment.assignmentType === 'private' 
                         ? 'Only this exchange can use this bank'
                         : 'This bank can be shared with other exchanges'
                       }
                     </p>
                   </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      )}

      {/* Add/Edit Bank Modal */}
      {showAddBank && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingBank ? 'Edit Bank' : 'Add New Bank'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bank Name *</label>
                  <input
                    type="text"
                    value={bankForm.name}
                    onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Arab Bank"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">CliQ Type *</label>
                  <select
                    value={bankForm.cliqType}
                    onChange={(e) => setBankForm({ ...bankForm, cliqType: e.target.value as 'alias' | 'mobile' })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="alias">Alias Name</option>
                    <option value="mobile">Mobile Number</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {bankForm.cliqType === 'alias' ? 'CliQ Alias Name' : 'Mobile Number'} *
                  </label>
                  <input
                    type="text"
                    value={bankForm.cliqValue}
                    onChange={(e) => setBankForm({ ...bankForm, cliqValue: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder={bankForm.cliqType === 'alias' ? 'e.g., MyBankAlias' : 'e.g., 07XXXXXXXX'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Account Holder *</label>
                  <input
                    type="text"
                    value={bankForm.accountHolder}
                    onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Initial Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={bankForm.balance}
                    onChange={(e) => setBankForm({ ...bankForm, balance: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={bankForm.description}
                    onChange={(e) => setBankForm({ ...bankForm, description: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={bankForm.isActive}
                    onChange={(e) => setBankForm({ ...bankForm, isActive: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Active
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddBank(false);
                    setEditingBank(null);
                    resetBankForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={editingBank ? handleUpdateBank : handleAddBank}
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : (editingBank ? 'Update' : 'Add')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Bank Modal */}
      {showAssignBank && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Assign Bank to Exchange</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Exchange *</label>
                  <select
                    value={assignmentForm.exchangeId}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, exchangeId: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Exchange</option>
                    {exchanges.map((exchange) => (
                      <option key={exchange.id} value={exchange.id}>
                        {exchange.exchangeName || exchange.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Bank *</label>
                  <select
                    value={assignmentForm.bankId}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, bankId: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Bank</option>
                    {banks.filter(bank => bank.isActive).map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.name} - {bank.cliqDetails.value}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Assignment Type</label>
                  <select
                    value={assignmentForm.assignmentType}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, assignmentType: e.target.value as 'private' | 'public' })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="public">Public (Shared)</option>
                    <option value="private">Private (Exclusive)</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Private: Only this exchange can use this bank. Public: Multiple exchanges can share this bank.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAssignBank(false);
                    resetAssignmentForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignBank}
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Assigning...' : 'Assign Bank'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 