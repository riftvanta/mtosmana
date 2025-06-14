'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { User, CommissionRate } from '@/types';
import CreateExchangeUser from './CreateExchangeUser';

interface ExchangeWithId extends User {
  id: string;
}

// Memoized components for better performance
const ExchangeCard = React.memo(({ 
  exchange, 
  onView, 
  onEdit, 
  onStatusUpdate,
  getStatusColor,
  getStatusIcon 
}: {
  exchange: ExchangeWithId;
  onView: (exchange: ExchangeWithId) => void;
  onEdit: (exchange: ExchangeWithId) => void;
  onStatusUpdate: (id: string, status: string) => void;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => string;
}) => {
  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onStatusUpdate(exchange.id, e.target.value);
  }, [exchange.id, onStatusUpdate]);

  const handleView = useCallback(() => onView(exchange), [exchange, onView]);
  const handleEdit = useCallback(() => onEdit(exchange), [exchange, onEdit]);

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-medium">
                {exchange.exchangeName?.charAt(0).toUpperCase() || exchange.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-gray-900">
                {exchange.exchangeName || exchange.username}
              </h3>
              <p className="text-sm text-gray-500">@{exchange.username}</p>
            </div>
          </div>
          
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(exchange.status)}`}>
            <span className="mr-1">{getStatusIcon(exchange.status)}</span>
            {exchange.status}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Balance:</span>
            <span className="font-medium">{exchange.balance?.toLocaleString() || 0}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Email:</span>
            <span className="font-medium truncate ml-2">
              {exchange.contactInfo?.email || 'Not provided'}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Phone:</span>
            <span className="font-medium">
              {exchange.contactInfo?.phone || 'Not provided'}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Created:</span>
            <span className="font-medium">
              {exchange.createdAt.toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleView}
            className="flex-1 bg-blue-50 text-blue-600 px-3 py-2 rounded-md hover:bg-blue-100 transition-colors text-sm"
          >
            👁️ View
          </button>
          
          <button
            onClick={handleEdit}
            className="flex-1 bg-gray-50 text-gray-600 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-sm"
          >
            ✏️ Edit
          </button>
          
          <div className="relative">
            <select
              value={exchange.status}
              onChange={handleStatusChange}
              className="bg-green-50 text-green-600 px-3 py-2 rounded-md hover:bg-green-100 transition-colors text-sm border-none focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="active">✅ Active</option>
              <option value="inactive">⏸️ Inactive</option>
              <option value="suspended">🚫 Suspended</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
});

ExchangeCard.displayName = 'ExchangeCard';

export default function ExchangesManagement() {
  const [exchanges, setExchanges] = useState<ExchangeWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<ExchangeWithId | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Memoized callbacks to prevent unnecessary re-renders
  const handleView = useCallback((exchange: ExchangeWithId) => {
    setSelectedExchange(exchange);
    setShowDetailsModal(true);
  }, []);

  const handleEdit = useCallback((exchange: ExchangeWithId) => {
    setSelectedExchange(exchange);
    setShowEditModal(true);
  }, []);

  const updateExchangeStatus = useCallback(async (exchangeId: string, newStatus: string) => {
    try {
      const exchangeRef = doc(db, 'users', exchangeId);
      await updateDoc(exchangeRef, {
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Optimized state update using functional update
      setExchanges(prev => prev.map(exchange => 
        exchange.id === exchangeId 
          ? { ...exchange, status: newStatus as 'active' | 'inactive' | 'suspended', updatedAt: new Date() }
          : exchange
      ));
    } catch (error) {
      console.error('Error updating exchange status:', error);
    }
  }, []);

  // Memoized utility functions
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'active': return '✅';
      case 'inactive': return '⏸️';
      case 'suspended': return '🚫';
      default: return '❓';
    }
  }, []);

  // Memoized filtered exchanges - expensive computation
  const filteredExchanges = useMemo(() => {
    return exchanges.filter(exchange => {
      const matchesSearch = 
        exchange.exchangeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exchange.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exchange.contactInfo?.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || exchange.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [exchanges, searchTerm, statusFilter]);

  // Memoized statistics calculation
  const stats = useMemo(() => ({
    total: exchanges.length,
    active: exchanges.filter(e => e.status === 'active').length,
    inactive: exchanges.filter(e => e.status === 'inactive').length,
    suspended: exchanges.filter(e => e.status === 'suspended').length,
    totalBalance: exchanges.reduce((sum, e) => sum + (e.balance || 0), 0)
  }), [exchanges]);

  // Optimized fetch function with error boundary
  const fetchExchanges = useCallback(async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'exchange'));
      const querySnapshot = await getDocs(q);
      
      const exchangeData: ExchangeWithId[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Handle backward compatibility for commission rates
        let commissionRates: { incoming: CommissionRate; outgoing: CommissionRate };
        
        if (data.commissionRates) {
          if (typeof data.commissionRates.incoming === 'number') {
            commissionRates = {
              incoming: { type: 'fixed', value: data.commissionRates.incoming },
              outgoing: { type: 'fixed', value: data.commissionRates.outgoing }
            };
          } else {
            commissionRates = data.commissionRates;
          }
        } else {
          commissionRates = {
            incoming: { type: 'fixed', value: 0 },
            outgoing: { type: 'fixed', value: 0 }
          };
        }
        
        exchangeData.push({
          id: doc.id,
          username: data.username,
          password: data.password,
          role: data.role,
          exchangeName: data.exchangeName,
          contactInfo: data.contactInfo,
          balance: data.balance || 0,
          commissionRates,
          assignedBanks: data.assignedBanks || [],
          status: data.status || 'active',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });
      
      // Sort by created date (newest first)
      exchangeData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setExchanges(exchangeData);
    } catch (error) {
      console.error('Error fetching exchanges:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExchanges();
  }, [fetchExchanges]);

  const deleteExchange = async (exchangeId: string) => {
    if (!confirm('Are you sure you want to delete this exchange? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'users', exchangeId));
      setExchanges(prev => prev.filter(exchange => exchange.id !== exchangeId));
    } catch (error) {
      console.error('Error deleting exchange:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-blue-500 text-white text-lg">🏪</div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">Total Exchanges</p>
              <p className="text-lg font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-green-500 text-white text-lg">✅</div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">Active</p>
              <p className="text-lg font-bold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-gray-500 text-white text-lg">⏸️</div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">Inactive</p>
              <p className="text-lg font-bold text-gray-900">{stats.inactive}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-red-500 text-white text-lg">🚫</div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">Suspended</p>
              <p className="text-lg font-bold text-gray-900">{stats.suspended}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-purple-500 text-white text-lg">💰</div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">Total Balance</p>
              <p className="text-lg font-bold text-gray-900">{stats.totalBalance.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header with Search and Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Exchanges Management</h2>
            <p className="text-sm text-gray-600">Manage and monitor all exchange offices</p>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
          >
            <span className="mr-2">➕</span>
            Add New Exchange
          </button>
        </div>
        
        <div className="mt-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search exchanges by name, username, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive' | 'suspended')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Exchanges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredExchanges.map((exchange) => (
          <ExchangeCard
            key={exchange.id}
            exchange={exchange}
            onView={handleView}
            onEdit={handleEdit}
            onStatusUpdate={updateExchangeStatus}
            getStatusColor={getStatusColor}
            getStatusIcon={getStatusIcon}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredExchanges.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-4xl mb-4">
            {searchTerm || statusFilter !== 'all' ? '🔍' : '🏪'}
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || statusFilter !== 'all' ? 'No exchanges found' : 'No exchanges yet'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first exchange to get started'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
            >
              ➕ Create First Exchange
            </button>
          )}
        </div>
      )}

      {/* Create Exchange Modal */}
      {showCreateModal && (
        <CreateExchangeUser 
          onUserCreated={() => {
            setShowCreateModal(false);
            fetchExchanges();
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Exchange Details Modal */}
      {showDetailsModal && selectedExchange && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-medium text-gray-900">Exchange Details</h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Exchange Name</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedExchange.exchangeName || 'Not provided'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Username</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedExchange.username}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedExchange.status)}`}>
                    <span className="mr-1">{getStatusIcon(selectedExchange.status)}</span>
                    {selectedExchange.status}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Balance</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedExchange.balance?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedExchange.contactInfo?.email || 'Not provided'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedExchange.contactInfo?.phone || 'Not provided'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Created</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedExchange.createdAt.toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedExchange.updatedAt.toLocaleString()}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Commission Rates</label>
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Incoming:</span> {selectedExchange.commissionRates.incoming.value}
                      {selectedExchange.commissionRates.incoming.type === 'percentage' ? '%' : ' (fixed)'}
                    </div>
                    <div>
                      <span className="font-medium">Outgoing:</span> {selectedExchange.commissionRates.outgoing.value}
                      {selectedExchange.commissionRates.outgoing.type === 'percentage' ? '%' : ' (fixed)'}
                    </div>
                  </div>
                </div>
              </div>
              
              {selectedExchange.assignedBanks && selectedExchange.assignedBanks.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Banks</label>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm text-gray-900">{selectedExchange.assignedBanks.join(', ')}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setShowEditModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Edit Exchange
              </button>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  deleteExchange(selectedExchange.id);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Exchange Modal */}
      {showEditModal && selectedExchange && (
        <EditExchangeModal
          exchange={selectedExchange}
          onSave={async (updatedData) => {
            try {
              const exchangeRef = doc(db, 'users', selectedExchange.id);
              await updateDoc(exchangeRef, {
                ...updatedData,
                updatedAt: new Date()
              });
              
              // Update local state
              setExchanges(prev => prev.map(exchange => 
                exchange.id === selectedExchange.id 
                  ? { ...exchange, ...updatedData, updatedAt: new Date() }
                  : exchange
              ));
              
              setShowEditModal(false);
              setSelectedExchange(null);
            } catch (error) {
              console.error('Error updating exchange:', error);
              alert('Failed to update exchange. Please try again.');
            }
          }}
          onClose={() => {
            setShowEditModal(false);
            setSelectedExchange(null);
          }}
        />
      )}
    </div>
  );
}

// Edit Exchange Modal Component
interface EditExchangeModalProps {
  exchange: ExchangeWithId;
  onSave: (data: Partial<User>) => void;
  onClose: () => void;
}

function EditExchangeModal({ exchange, onSave, onClose }: EditExchangeModalProps) {
  const [formData, setFormData] = useState({
    exchangeName: exchange.exchangeName || '',
    email: exchange.contactInfo?.email || '',
    phone: exchange.contactInfo?.phone || '',
    balance: exchange.balance || 0,
    status: exchange.status || 'active' as 'active' | 'inactive' | 'suspended',
    incomingCommissionType: exchange.commissionRates.incoming.type,
    incomingCommissionValue: exchange.commissionRates.incoming.value,
    outgoingCommissionType: exchange.commissionRates.outgoing.type,
    outgoingCommissionValue: exchange.commissionRates.outgoing.value,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSave({
      exchangeName: formData.exchangeName,
      contactInfo: {
        email: formData.email,
        phone: formData.phone,
      },
      balance: formData.balance,
      status: formData.status,
      commissionRates: {
        incoming: {
          type: formData.incomingCommissionType,
          value: formData.incomingCommissionValue,
        },
        outgoing: {
          type: formData.outgoingCommissionType,
          value: formData.outgoingCommissionValue,
        },
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-medium text-gray-900">Edit Exchange</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exchange Name
              </label>
              <input
                type="text"
                value={formData.exchangeName}
                onChange={(e) => setFormData({ ...formData, exchangeName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter exchange name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'suspended' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="exchange@example.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+962 7X XXX XXXX"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Balance
              </label>
              <input
                type="number"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                step="0.01"
              />
            </div>
          </div>
          
          {/* Commission Rates */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Commission Rates</label>
            <div className="bg-gray-50 p-4 rounded-md space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Incoming Commission Type
                  </label>
                  <select
                    value={formData.incomingCommissionType}
                    onChange={(e) => setFormData({ ...formData, incomingCommissionType: e.target.value as 'fixed' | 'percentage' })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Incoming Commission Value
                  </label>
                  <input
                    type="number"
                    value={formData.incomingCommissionValue}
                    onChange={(e) => setFormData({ ...formData, incomingCommissionValue: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="0"
                    step="0.01"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Outgoing Commission Type
                  </label>
                  <select
                    value={formData.outgoingCommissionType}
                    onChange={(e) => setFormData({ ...formData, outgoingCommissionType: e.target.value as 'fixed' | 'percentage' })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Outgoing Commission Value
                  </label>
                  <input
                    type="number"
                    value={formData.outgoingCommissionValue}
                    onChange={(e) => setFormData({ ...formData, outgoingCommissionValue: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 