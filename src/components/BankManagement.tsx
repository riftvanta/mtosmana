'use client';

import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    loadData();
    
    // Set up real-time listener for banks
    const unsubscribe = subscribeToPlatformBanks((updatedBanks) => {
      setBanks(updatedBanks);
    });

    return () => unsubscribe();
  }, []);

  const loadData = async () => {
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
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBank = async () => {
    if (!bankForm.name || !bankForm.cliqValue || !bankForm.accountHolder) {
      setError('Please fill in all required fields');
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
      isActive: bankForm.isActive
    };
    
    const result = await createPlatformBank(bankData);
    
    if (result.success) {
      setSuccess('Bank added successfully');
      setShowAddBank(false);
      resetBankForm();
    } else {
      setError(result.error || 'Failed to add bank');
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
      isActive: bankForm.isActive
    };
    
    const result = await updatePlatformBank(editingBank.id, bankData);
    
    if (result.success) {
      setSuccess('Bank updated successfully');
      setEditingBank(null);
      resetBankForm();
    } else {
      setError(result.error || 'Failed to update bank');
    }
    setLoading(false);
  };

  const handleDeleteBank = async (bankId: string) => {
    if (!confirm('Are you sure you want to delete this bank?')) return;

    setLoading(true);
    const result = await deletePlatformBank(bankId);
    
    if (result.success) {
      setSuccess('Bank deleted successfully');
    } else {
      setError(result.error || 'Failed to delete bank');
    }
    setLoading(false);
  };

  const handleAssignBank = async () => {
    if (!assignmentForm.exchangeId || !assignmentForm.bankId) {
      setError('Please select both exchange and bank');
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
      setSuccess('Bank assigned successfully');
      setShowAssignBank(false);
      resetAssignmentForm();
      loadData(); // Reload assignments
    } else {
      setError(result.error || 'Failed to assign bank');
    }
    setLoading(false);
  };

  const handleRemoveAssignment = async (exchangeId: string, bankId: string) => {
    if (!confirm('Are you sure you want to remove this bank assignment?')) return;

    setLoading(true);
    const result = await removeBankAssignment(exchangeId, bankId);
    
    if (result.success) {
      setSuccess('Bank assignment removed');
      loadData(); // Reload assignments
    } else {
      setError(result.error || 'Failed to remove assignment');
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
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('banks')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'banks'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Platform Banks ({banks.length})
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'assignments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Bank Assignments ({assignments.length})
          </button>
        </nav>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4 mb-4">
          <div className="text-sm text-green-800">{success}</div>
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
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Bank Assignments</h3>
            <button
              onClick={() => {
                setShowAssignBank(true);
                resetAssignmentForm();
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
            >
              Assign Bank
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Exchange
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getExchangeName(assignment.exchangeId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getBankName(assignment.bankId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        assignment.assignmentType === 'private'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {assignment.assignmentType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {assignment.assignedAt.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleRemoveAssignment(assignment.exchangeId, assignment.bankId)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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