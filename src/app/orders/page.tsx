'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import OrderManagement from '@/components/OrderManagement';
import { User, CommissionRate, BankAssignment, PlatformBank } from '@/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [userCommissionRate, setUserCommissionRate] = useState<CommissionRate | null>(null);
  const [assignedBanks, setAssignedBanks] = useState<(BankAssignment & { bank: PlatformBank })[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const loadUserData = useCallback(async () => {
    if (!user) return;

    try {
      setDataLoading(true);

      // Get user details including commission rates
      const usersQuery = query(collection(db, 'users'), where('username', '==', user.username));
      const usersSnapshot = await getDocs(usersQuery);
      
      if (!usersSnapshot.empty) {
        const userData = usersSnapshot.docs[0].data() as User;
        
        // Set commission rate based on user role
        if (user.role === 'exchange') {
          setUserCommissionRate(userData.commissionRates?.outgoing || { type: 'percentage', value: 2 });
          
          // Load assigned banks for exchange
          await loadAssignedBanks(user.id);
        } else {
          // For admin, use default rates
          setUserCommissionRate({ type: 'percentage', value: 0 });
        }
      }


    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      loadUserData();
    }
  }, [user, loading, router, loadUserData]);

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



  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <OrderManagement
          userRole={user.role}
          userCommissionRate={userCommissionRate || undefined}
          assignedBanks={assignedBanks}
        />
      </div>
    </div>
  );
} 