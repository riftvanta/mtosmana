'use client';

import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useRouter, useSearchParams } from 'next/navigation';
import OutgoingTransferForm from '@/components/OutgoingTransferForm';
import IncomingTransferForm from '@/components/IncomingTransferForm';
import { User, CommissionRate, BankAssignment, PlatformBank } from '@/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type OrderType = 'incoming' | 'outgoing';

function NewOrderPageContent() {
  const { user, loading } = useAuth();
  const { showSuccess, showError } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [userCommissionRate, setUserCommissionRate] = useState<CommissionRate | null>(null);
  const [assignedBanks, setAssignedBanks] = useState<(BankAssignment & { bank: PlatformBank })[]>([]);

  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user?.role !== 'exchange') {
      router.push('/dashboard');
      return;
    }

    // Get order type from URL params
    const type = searchParams.get('type') as OrderType;
    if (type && ['incoming', 'outgoing'].includes(type)) {
      setOrderType(type);
    }

    if (user) {
      loadUserData();
    }
  }, [user, loading, router, searchParams]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      setDataLoading(true);

      // Get user details including commission rates
      const usersQuery = query(collection(db, 'users'), where('username', '==', user.username));
      const usersSnapshot = await getDocs(usersQuery);
      
      if (!usersSnapshot.empty) {
        const userData = usersSnapshot.docs[0].data() as User;
        
        // Set commission rates with proper fallback
        const outgoingRate = userData.commissionRates?.outgoing;
        if (outgoingRate && outgoingRate.type && typeof outgoingRate.value === 'number') {
          setUserCommissionRate(outgoingRate);
        } else {
          // Fallback to default commission rate
          setUserCommissionRate({ type: 'fixed', value: 0 });
        }
        
        // Load assigned banks for exchange
        await loadAssignedBanks(user.id);
      }


    } catch (error) {
      console.error('Error loading user data:', error);
      showError('Loading Error', 'Failed to load user data. Please refresh the page and try again.');
    } finally {
      setDataLoading(false);
    }
  };

  const loadAssignedBanks = async (exchangeId: string) => {
    try {
      const assignmentsQuery = query(
        collection(db, 'bankAssignments'),
        where('exchangeId', '==', exchangeId),
        where('isActive', '==', true)
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      
      const assignments: (BankAssignment & { bank: PlatformBank })[] = [];
      
      for (const assignmentDoc of assignmentsSnapshot.docs) {
        const assignment = { id: assignmentDoc.id, ...assignmentDoc.data() } as BankAssignment;
        
        // Get the associated bank
        const bankQuery = query(collection(db, 'platformBanks'), where('id', '==', assignment.bankId));
        const bankSnapshot = await getDocs(bankQuery);
        
        if (!bankSnapshot.empty) {
          const bank = bankSnapshot.docs[0].data() as PlatformBank;
          assignments.push({ ...assignment, bank });
        }
      }
      
      setAssignedBanks(assignments);
    } catch (error) {
      console.error('Error loading assigned banks:', error);
    }
  };



  const handleOrderCreated = (orderId: string) => {
    // Show success toast
    showSuccess('Order Created Successfully!', `Order ${orderId} has been created and is ready for processing.`);
    
    // Redirect to orders page
    setTimeout(() => {
      router.push('/orders');
    }, 1500);
  };

  const handleCancel = () => {
    router.push('/orders');
  };

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'exchange') {
    return null; // Will redirect
  }

  // Order type selection screen
  if (!orderType) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <button
                  onClick={() => router.push('/orders')}
                  className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Create New Transfer</h1>
                  <p className="text-gray-600">Choose the type of transfer you want to create</p>
                </div>
              </div>
            </div>

            {/* Order Type Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Outgoing Transfer */}
              <div
                onClick={() => setOrderType('outgoing')}
                className="bg-white p-8 rounded-lg shadow border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-colors group"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-colors">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Outgoing Transfer</h3>
                  <p className="text-gray-600 mb-4">Send money via CliQ to customers</p>
                  <div className="text-sm text-gray-500">
                    <p>• CliQ payment processing</p>
                    <p>• Mobile number or alias</p>
                    <p>• Instant transfers</p>
                  </div>
                </div>
              </div>

              {/* Incoming Transfer */}
              <div
                onClick={() => setOrderType('incoming')}
                className="bg-white p-8 rounded-lg shadow border-2 border-gray-200 hover:border-green-500 cursor-pointer transition-colors group"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-200 transition-colors">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Incoming Transfer</h3>
                  <p className="text-gray-600 mb-4">Receive money to bank account</p>
                  <div className="text-sm text-gray-500">
                    <p>• Upload payment proof</p>
                    <p>• Bank account credits</p>
                    <p>• Photo verification</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-8 text-center">
              <p className="text-gray-500 text-sm mb-4">Need help choosing?</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                  <strong className="text-blue-800">Outgoing:</strong> When you need to send money to someone using their CliQ details
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
                  <strong className="text-green-800">Incoming:</strong> When someone sent you money and you need to report the receipt
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render the appropriate form based on order type
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center mb-4">
              <button
                onClick={() => setOrderType(null)}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {orderType === 'outgoing' ? 'New Outgoing Transfer' : 'New Incoming Transfer'}
                </h1>
                <p className="text-gray-600">
                  {orderType === 'outgoing' 
                    ? 'Send money via CliQ to a customer' 
                    : 'Report money received to your bank account'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          {orderType === 'outgoing' && userCommissionRate ? (
            <OutgoingTransferForm
              onOrderCreated={handleOrderCreated}
              onCancel={handleCancel}
              userCommissionRate={userCommissionRate}
            />
          ) : orderType === 'incoming' && userCommissionRate ? (
            <IncomingTransferForm
              onOrderCreated={handleOrderCreated}
              onCancel={handleCancel}
              userCommissionRate={userCommissionRate}
              assignedBanks={assignedBanks}
            />
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading form...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <NewOrderPageContent />
    </Suspense>
  );
} 