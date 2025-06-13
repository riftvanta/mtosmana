'use client';

import React, { useState } from 'react';
import { createExchangeUser } from '@/lib/auth';

interface CreateExchangeUserProps {
  onUserCreated?: () => void;
}

export default function CreateExchangeUser({ onUserCreated }: CreateExchangeUserProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    exchangeName: '',
    balance: 0,
    commissionIncoming: 0,
    commissionOutgoing: 0,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const userData = {
        username: formData.username,
        password: formData.password,
        exchangeName: formData.exchangeName,
        balance: formData.balance,
        commissionRates: {
          incoming: formData.commissionIncoming,
          outgoing: formData.commissionOutgoing,
        }
      };

      const result = await createExchangeUser(userData);
      
      if (result) {
        setSuccess(`Exchange user "${formData.username}" created successfully!`);
        setFormData({
          username: '',
          password: '',
          exchangeName: '',
          balance: 0,
          commissionIncoming: 0,
          commissionOutgoing: 0,
        });
        onUserCreated?.();
        
        // Auto close after 3 seconds
        setTimeout(() => {
          setIsOpen(false);
          setSuccess('');
        }, 3000);
      } else {
        setError('Failed to create exchange user. Username might already exist.');
      }
    } catch (error) {
      setError('An error occurred while creating the exchange user.');
      console.error('Error creating exchange user:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <span className="mr-2">➕</span>
        Create Exchange User
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Create New Exchange User</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username *
              </label>
              <input
                type="text"
                name="username"
                id="username"
                required
                value={formData.username}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="e.g., exchange2"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <input
                type="password"
                name="password"
                id="password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Secure password"
              />
            </div>

            <div>
              <label htmlFor="exchangeName" className="block text-sm font-medium text-gray-700">
                Exchange Name *
              </label>
              <input
                type="text"
                name="exchangeName"
                id="exchangeName"
                required
                value={formData.exchangeName}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="e.g., Jordan Money Exchange"
              />
            </div>

            <div>
              <label htmlFor="balance" className="block text-sm font-medium text-gray-700">
                Initial Balance (JOD)
              </label>
              <input
                type="number"
                name="balance"
                id="balance"
                step="0.01"
                value={formData.balance}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="0.00"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="commissionIncoming" className="block text-sm font-medium text-gray-700">
                  Incoming Commission (JOD)
                </label>
                <input
                  type="number"
                  name="commissionIncoming"
                  id="commissionIncoming"
                  step="0.01"
                  value={formData.commissionIncoming}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="2.50"
                />
              </div>

              <div>
                <label htmlFor="commissionOutgoing" className="block text-sm font-medium text-gray-700">
                  Outgoing Commission (JOD)
                </label>
                <input
                  type="number"
                  name="commissionOutgoing"
                  id="commissionOutgoing"
                  step="0.01"
                  value={formData.commissionOutgoing}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="1.50"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <div className="text-sm text-red-800">{error}</div>
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-50 p-3">
                <div className="text-sm text-green-800">{success}</div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 