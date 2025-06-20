import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  writeBatch,
  onSnapshot,
  documentId,
  enableNetwork,
  disableNetwork
} from 'firebase/firestore';
import { db } from './firebase';
import { PlatformBank, BankAssignment } from '@/types';

// Performance Cache Implementation
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: unknown; timestamp: number }>();

// Cache utility functions
const getCachedData = <T>(key: string): T | null => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }
  return null;
};

const setCachedData = (key: string, data: unknown) => {
  cache.set(key, { data, timestamp: Date.now() });
};

// Connection pooling and performance monitoring
let networkEnabled = true;
const connectionListeners = new Set<() => void>();

export const monitorConnection = () => {
  window.addEventListener('online', () => {
    if (!networkEnabled) {
      enableNetwork(db);
      networkEnabled = true;
      connectionListeners.forEach(listener => listener());
    }
  });

  window.addEventListener('offline', () => {
    if (networkEnabled) {
      disableNetwork(db);
      networkEnabled = false;
    }
  });
};



// Platform Banks Operations
export const createPlatformBank = async (bankData: Omit<PlatformBank, 'id' | 'createdAt' | 'updatedAt'>) => {
  try {
    const banksRef = collection(db, 'platformBanks');
    const docRef = await addDoc(banksRef, {
      ...bankData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error creating platform bank:', error);
    return { success: false, error: 'Failed to create platform bank' };
  }
};

export const getAllPlatformBanks = async () => {
  try {
    const banksRef = collection(db, 'platformBanks');
    const q = query(banksRef, orderBy('name'));
    const querySnapshot = await getDocs(q);
    
    const banks: PlatformBank[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      banks.push({
        id: doc.id,
        name: data.name,
        cliqDetails: data.cliqDetails || { type: 'alias', value: '' },
        accountHolder: data.accountHolder,
        balance: data.balance || 0,
        isActive: data.isActive,
        description: data.description,
        priority: data.priority || 1,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      });
    });
    
    return { success: true, data: banks };
  } catch (error) {
    console.error('Error fetching platform banks:', error);
    return { success: false, error: 'Failed to fetch platform banks' };
  }
};

export const getActivePlatformBanks = async () => {
  try {
    const banksRef = collection(db, 'platformBanks');
    const q = query(banksRef, where('isActive', '==', true), orderBy('name'));
    const querySnapshot = await getDocs(q);
    
    const banks: PlatformBank[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      banks.push({
        id: doc.id,
        name: data.name,
        cliqDetails: data.cliqDetails || { type: 'alias', value: '' },
        accountHolder: data.accountHolder,
        balance: data.balance || 0,
        isActive: data.isActive,
        description: data.description,
        priority: data.priority || 1,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      });
    });
    
    return { success: true, data: banks };
  } catch (error) {
    console.error('Error fetching active platform banks:', error);
    return { success: false, error: 'Failed to fetch active platform banks' };
  }
};

export const updatePlatformBank = async (bankId: string, updates: Partial<PlatformBank>) => {
  try {
    const bankRef = doc(db, 'platformBanks', bankId);
    await updateDoc(bankRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating platform bank:', error);
    return { success: false, error: 'Failed to update platform bank' };
  }
};

export const updatePlatformBankBalance = async (bankId: string, newBalance: number) => {
  try {
    const bankRef = doc(db, 'platformBanks', bankId);
    await updateDoc(bankRef, {
      balance: newBalance,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating platform bank balance:', error);
    return { success: false, error: 'Failed to update bank balance' };
  }
};

export const deletePlatformBank = async (bankId: string) => {
  try {
    // Check if bank is assigned to any exchanges
    const assignmentsRef = collection(db, 'bankAssignments');
    const q = query(assignmentsRef, where('bankId', '==', bankId), where('isActive', '==', true));
    const assignments = await getDocs(q);
    
    if (!assignments.empty) {
      return { success: false, error: 'Cannot delete bank that is assigned to exchanges' };
    }
    
    const bankRef = doc(db, 'platformBanks', bankId);
    await deleteDoc(bankRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting platform bank:', error);
    return { success: false, error: 'Failed to delete platform bank' };
  }
};

// Bank Assignment Operations
export const assignBankToExchange = async (
  exchangeId: string, 
  bankId: string, 
  assignmentType: 'private' | 'public',
  assignedBy: string
) => {
  try {
    // Check if assignment already exists
    const assignmentsRef = collection(db, 'bankAssignments');
    const existingQuery = query(
      assignmentsRef, 
      where('exchangeId', '==', exchangeId),
      where('bankId', '==', bankId),
      where('isActive', '==', true)
    );
    const existing = await getDocs(existingQuery);
    
    if (!existing.empty) {
      return { success: false, error: 'Bank is already assigned to this exchange' };
    }
    
    const docRef = await addDoc(assignmentsRef, {
      exchangeId,
      bankId,
      assignmentType,
      isActive: true,
      assignedAt: serverTimestamp(),
      assignedBy
    });
    
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error assigning bank to exchange:', error);
    return { success: false, error: 'Failed to assign bank to exchange' };
  }
};

export const getExchangeAssignedBanks = async (exchangeId: string) => {
  try {
    const assignmentsRef = collection(db, 'bankAssignments');
    const q = query(
      assignmentsRef, 
      where('exchangeId', '==', exchangeId),
      where('isActive', '==', true)
    );
    const assignmentsSnapshot = await getDocs(q);
    
    const bankIds: string[] = [];
    assignmentsSnapshot.forEach((doc) => {
      bankIds.push(doc.data().bankId);
    });
    
    if (bankIds.length === 0) {
      return { success: true, data: [] };
    }
    
    // Get the actual bank details
    const banks: PlatformBank[] = [];
    for (const bankId of bankIds) {
      const bankRef = doc(db, 'platformBanks', bankId);
      const bankDoc = await getDoc(bankRef);
      if (bankDoc.exists() && bankDoc.data().isActive) {
        const data = bankDoc.data();
        banks.push({
          id: bankDoc.id,
          name: data.name,
          cliqDetails: data.cliqDetails || { type: 'alias', value: '' },
          accountHolder: data.accountHolder,
          balance: data.balance || 0,
          isActive: data.isActive,
          description: data.description,
          priority: data.priority || 1,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        });
      }
    }
    
    return { success: true, data: banks };
  } catch (error) {
    console.error('Error fetching exchange assigned banks:', error);
    return { success: false, error: 'Failed to fetch assigned banks' };
  }
};

export const removeBankAssignment = async (exchangeId: string, bankId: string) => {
  try {
    const assignmentsRef = collection(db, 'bankAssignments');
    const q = query(
      assignmentsRef,
      where('exchangeId', '==', exchangeId),
      where('bankId', '==', bankId),
      where('isActive', '==', true)
    );
    const querySnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
      batch.update(doc.ref, { isActive: false });
    });
    
    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error('Error removing bank assignment:', error);
    return { success: false, error: 'Failed to remove bank assignment' };
  }
};

export const getAllBankAssignments = async () => {
  try {
    const assignmentsRef = collection(db, 'bankAssignments');
    const q = query(assignmentsRef, where('isActive', '==', true));
    const querySnapshot = await getDocs(q);
    
    const assignments: BankAssignment[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      assignments.push({
        id: doc.id,
        exchangeId: data.exchangeId,
        bankId: data.bankId,
        assignmentType: data.assignmentType,
        isActive: data.isActive,
        priority: data.priority || 1,
        assignedAt: data.assignedAt?.toDate() || new Date(),
        assignedBy: data.assignedBy
      });
    });
    
    return { success: true, data: assignments };
  } catch (error) {
    console.error('Error fetching bank assignments:', error);
    return { success: false, error: 'Failed to fetch bank assignments' };
  }
};

// Real-time listeners
export const subscribeToPlatformBanks = (callback: (banks: PlatformBank[]) => void) => {
  const banksRef = collection(db, 'platformBanks');
  const q = query(banksRef, orderBy('name'));
  
  return onSnapshot(q, (querySnapshot) => {
    const banks: PlatformBank[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      banks.push({
        id: doc.id,
        name: data.name,
        cliqDetails: data.cliqDetails || { type: 'alias', value: '' },
        accountHolder: data.accountHolder,
        balance: data.balance || 0,
        isActive: data.isActive,
        description: data.description,
        priority: data.priority || 1,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      });
    });
    callback(banks);
  });
};

// OPTIMIZED: Batch query for multiple banks
export const getBanksByIds = async (bankIds: string[]): Promise<PlatformBank[]> => {
  if (bankIds.length === 0) return [];
  
  const cacheKey = `banks-${bankIds.sort().join(',')}`;
  const cached = getCachedData<PlatformBank[]>(cacheKey);
  if (cached) return cached;

  try {
    // Use batch query instead of sequential queries
    const banksRef = collection(db, 'platformBanks');
    const q = query(banksRef, where(documentId(), 'in', bankIds));
    const querySnapshot = await getDocs(q);
    
    const banks: PlatformBank[] = [];
    querySnapshot.forEach((doc) => {
      if (doc.exists()) {
        const data = doc.data();
        banks.push({
          id: doc.id,
          name: data.name,
          cliqDetails: data.cliqDetails || { type: 'alias', value: '' },
          accountHolder: data.accountHolder,
          balance: data.balance || 0,
          isActive: data.isActive,
          description: data.description,
          priority: data.priority || 1,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        });
      }
    });
    
    setCachedData(cacheKey, banks);
    return banks;
  } catch (error) {
    console.error('Error fetching banks by IDs:', error);
    return [];
  }
};

// OPTIMIZED: Combined query with proper indexing
export const getActivePlatformBanksWithAssignments = async () => {
  const cacheKey = 'active-banks-with-assignments';
  const cached = getCachedData<{ banks: PlatformBank[]; assignments: BankAssignment[] }>(cacheKey);
  if (cached) return cached;

  try {
    // Use composite index: isActive + name
    const banksRef = collection(db, 'platformBanks');
    const q = query(
      banksRef, 
      where('isActive', '==', true), 
      orderBy('name') // Requires composite index
    );
    const querySnapshot = await getDocs(q);
    
    const result = {
      banks: [] as PlatformBank[],
      assignments: [] as BankAssignment[]
    };
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      result.banks.push({
        id: doc.id,
        name: data.name,
        cliqDetails: data.cliqDetails || { type: 'alias', value: '' },
        accountHolder: data.accountHolder,
        balance: data.balance || 0,
        isActive: data.isActive,
        description: data.description,
        priority: data.priority || 1,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      });
    });
    
    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching active banks with assignments:', error);
    return { banks: [], assignments: [] };
  }
};

// OPTIMIZED: Real-time listener with efficient data handling
export const subscribeToExchangeBanks = (exchangeId: string, callback: (banks: PlatformBank[]) => void) => {
  const assignmentsRef = collection(db, 'bankAssignments');
  const q = query(
    assignmentsRef,
    where('exchangeId', '==', exchangeId),
    where('isActive', '==', true)
  );
  
  return onSnapshot(q, async (querySnapshot) => {
    const bankIds: string[] = [];
    querySnapshot.forEach((doc) => {
      bankIds.push(doc.data().bankId);
    });
    
    if (bankIds.length === 0) {
      callback([]);
      return;
    }
    
    // Use optimized batch query
    const banks = await getBanksByIds(bankIds);
    callback(banks.filter(bank => bank.isActive));
  }, (error) => {
    console.error('Error in banks subscription:', error);
    callback([]);
  });
};

// OPTIMIZED: Batch write operations
export const bulkUpdateBankStatus = async (bankIds: string[], isActive: boolean) => {
  try {
    const batch = writeBatch(db);
    
    bankIds.forEach(bankId => {
      const bankRef = doc(db, 'platformBanks', bankId);
      batch.update(bankRef, {
        isActive,
        updatedAt: serverTimestamp()
      });
    });
    
    await batch.commit();
    
    // Clear relevant cache entries
    cache.clear();
    
    return { success: true };
  } catch (error) {
    console.error('Error in bulk update:', error);
    return { success: false, error: 'Failed to update banks' };
  }
};

// Cache invalidation utility
export const invalidateCache = (pattern?: string) => {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}; 