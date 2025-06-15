import { 
  Order, 
  OrderType, 
  OrderStatus, 
  OrderAction,
  OrderWorkflowAction,
  OrderFilters,
  OrderSortOptions,
  OrderStatistics,
  CommissionRate,
  PaginatedResponse,
  PaginationOptions,
  OrderFile
} from '@/types';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  runTransaction,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

// Jordanian timezone handling
const JORDAN_TIMEZONE = 'Asia/Amman';

/**
 * Get current date in Jordanian timezone
 */
export function getJordanianDate(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: JORDAN_TIMEZONE }));
}

/**
 * Format date to Jordanian timezone string
 */
export function formatJordanianDate(date: Date, format = 'yyyy-MM-dd HH:mm:ss'): string {
  const jordanianDate = new Date(date.toLocaleString("en-US", { timeZone: JORDAN_TIMEZONE }));
  
  const yyyy = jordanianDate.getFullYear();
  const MM = String(jordanianDate.getMonth() + 1).padStart(2, '0');
  const dd = String(jordanianDate.getDate()).padStart(2, '0');
  const HH = String(jordanianDate.getHours()).padStart(2, '0');
  const mm = String(jordanianDate.getMinutes()).padStart(2, '0');
  const ss = String(jordanianDate.getSeconds()).padStart(2, '0');
  
  return format
    .replace('yyyy', yyyy.toString())
    .replace('MM', MM)
    .replace('dd', dd)
    .replace('HH', HH)
    .replace('mm', mm)
    .replace('ss', ss);
}

/**
 * Generate unique order ID in TYYMMXXXX format
 * T = Transfer, YY = Year (25 for 2025), MM = Month, XXXX = Sequential number
 */
export async function generateOrderId(): Promise<string> {
  const jordanianDate = getJordanianDate();
  const year = jordanianDate.getFullYear().toString().slice(-2); // Last 2 digits
  const month = String(jordanianDate.getMonth() + 1).padStart(2, '0');
  const prefix = `T${year}${month}`;
  
  return await runTransaction(db, async (transaction) => {
    // Get the counter document for this month
    const counterRef = doc(db, 'counters', `orders_${year}${month}`);
    const counterDoc = await transaction.get(counterRef);
    
    let sequence = 1;
    if (counterDoc.exists()) {
      sequence = counterDoc.data().count + 1;
    }
    
    // Update the counter
    transaction.set(counterRef, { 
      count: sequence,
      lastUpdated: serverTimestamp(),
      prefix: prefix
    });
    
    // Format sequence with leading zeros (4 digits)
    const sequenceStr = String(sequence).padStart(4, '0');
    return `${prefix}${sequenceStr}`;
  });
}

/**
 * Validate Jordanian mobile number
 */
export function validateJordanianMobile(mobile: string): boolean {
  // Remove all non-digit characters
  const cleaned = mobile.replace(/\D/g, '');
  
  // Check for valid Jordanian mobile formats
  // 077XXXXXXX, 078XXXXXXX, 079XXXXXXX (10 digits) - National format
  // 96277XXXXXXX, 96278XXXXXXX, 96279XXXXXXX (12 digits with country code)
  // 0096277XXXXXXX, 0096278XXXXXXX, 0096279XXXXXXX (14 digits with full international prefix)
  
  if (cleaned.length === 10) {
    // National format: 077XXXXXXX, 078XXXXXXX, 079XXXXXXX
    return /^07[789]\d{7}$/.test(cleaned);
  } else if (cleaned.length === 12) {
    // Country code format: 96277XXXXXXX, 96278XXXXXXX, 96279XXXXXXX
    return /^96277\d{7}$/.test(cleaned) || /^96278\d{7}$/.test(cleaned) || /^96279\d{7}$/.test(cleaned);
  } else if (cleaned.length === 14) {
    // Full international format: 0096277XXXXXXX, 0096278XXXXXXX, 0096279XXXXXXX
    return /^0096277\d{7}$/.test(cleaned) || /^0096278\d{7}$/.test(cleaned) || /^0096279\d{7}$/.test(cleaned);
  }
  
  return false;
}

/**
 * Format Jordanian mobile number to standard format
 */
export function formatJordanianMobile(mobile: string): string {
  const cleaned = mobile.replace(/\D/g, '');
  
  // Format 10-digit national numbers (077XXXXXXX, 078XXXXXXX, 079XXXXXXX)
  if (cleaned.length === 10 && /^07[789]\d{7}$/.test(cleaned)) {
    // Remove leading 0 and format: 0790909910 -> 962790909910 -> +962 79 090 9910
    const national = cleaned.slice(1); // Remove leading 0: "790909910"
    return `+962 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
  }
  // Format 12-digit international numbers (96277XXXXXXX, 96278XXXXXXX, 96279XXXXXXX)
  else if (cleaned.length === 12 && /^96277\d{7}$|^96278\d{7}$|^96279\d{7}$/.test(cleaned)) {
    return `+962 ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }
  // Format 14-digit full international numbers
  else if (cleaned.length === 14 && /^0096277\d{7}$|^0096278\d{7}$|^0096279\d{7}$/.test(cleaned)) {
    return `+962 ${cleaned.slice(5, 7)} ${cleaned.slice(7, 10)} ${cleaned.slice(10)}`;
  }
  
  return mobile; // Return original if can't format
}

/**
 * Calculate commission based on rate and amount
 */
export function calculateCommission(amount: number, rate: CommissionRate): number {
  // Validate inputs
  if (!rate || typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    return 0;
  }

  // Ensure rate has valid properties
  if (!rate.type || typeof rate.value !== 'number' || isNaN(rate.value) || rate.value < 0) {
    return 0;
  }

  if (rate.type === 'percentage') {
    const commission = (amount * rate.value) / 100;
    return Math.round(commission * 100) / 100; // Round to 2 decimal places
  } else if (rate.type === 'fixed') {
    return Math.round(rate.value * 100) / 100; // Round to 2 decimal places
  }
  
  return 0;
}

/**
 * Calculate net amount after commission for incoming transfers
 */
export function calculateNetAmount(submittedAmount: number, commission: number, type: OrderType): number {
  if (type === 'incoming') {
    return submittedAmount - commission;
  } else {
    // For outgoing, the amount is what user pays, commission is separate
    return submittedAmount;
  }
}

/**
 * Validate order status transition
 */
export function isValidStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus, userRole: 'admin' | 'exchange'): boolean {
  const adminTransitions: Record<OrderStatus, OrderStatus[]> = {
    'submitted': ['processing', 'rejected', 'cancelled'], // Admin approves by moving to processing
    'pending_review': ['processing', 'rejected', 'cancelled'], // Keep for backwards compatibility
    'approved': ['processing', 'cancelled'], // Keep for backwards compatibility
    'rejected': ['processing'], // Admin can reopen rejected orders by moving to processing
    'processing': ['completed', 'cancelled'],
    'completed': [], // Final state
    'cancelled': [], // Final state
    'cancellation_requested': ['cancelled', 'processing'] // Admin can approve or deny cancellation
  };

  const exchangeTransitions: Record<OrderStatus, OrderStatus[]> = {
    'submitted': ['cancelled'], // Exchange can cancel before review
    'pending_review': [], // No direct transitions
    'approved': ['cancellation_requested'], // Exchange can request cancellation
    'rejected': [], // No transitions
    'processing': ['cancellation_requested'], // Exchange can request cancellation
    'completed': [], // Final state
    'cancelled': [], // Final state
    'cancellation_requested': [] // Waiting for admin decision
  };

  const allowedTransitions = userRole === 'admin' ? adminTransitions : exchangeTransitions;
  return allowedTransitions[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Get next allowed statuses for an order
 */
export function getNextAllowedStatuses(currentStatus: OrderStatus, userRole: 'admin' | 'exchange'): OrderStatus[] {
  const adminTransitions: Record<OrderStatus, OrderStatus[]> = {
    'submitted': ['processing', 'rejected', 'cancelled'], // Admin approves by moving to processing
    'pending_review': ['processing', 'rejected', 'cancelled'], // Keep for backwards compatibility
    'approved': ['processing', 'cancelled'], // Keep for backwards compatibility
    'rejected': ['processing'], // Admin can reopen rejected orders by moving to processing
    'processing': ['completed', 'cancelled'],
    'completed': [],
    'cancelled': [],
    'cancellation_requested': ['cancelled', 'processing']
  };

  const exchangeTransitions: Record<OrderStatus, OrderStatus[]> = {
    'submitted': ['cancelled'],
    'pending_review': [],
    'approved': ['cancellation_requested'],
    'rejected': [],
    'processing': ['cancellation_requested'],
    'completed': [],
    'cancelled': [],
    'cancellation_requested': []
  };

  const allowedTransitions = userRole === 'admin' ? adminTransitions : exchangeTransitions;
  return allowedTransitions[currentStatus] ?? [];
}

/**
 * Create order workflow action
 */
export async function createWorkflowAction(
  orderId: string,
  action: OrderAction,
  performedBy: string,
  performedByRole: 'admin' | 'exchange',
  previousStatus: OrderStatus,
  newStatus: OrderStatus,
  notes?: string,
  reason?: string,
  metadata?: Record<string, string | number | boolean>
): Promise<string> {
  // Build workflow action without undefined values
  const workflowAction: Partial<Omit<OrderWorkflowAction, 'id'>> & {
    orderId: string;
    action: OrderAction;
    performedBy: string;
    performedByRole: 'admin' | 'exchange';
    previousStatus: OrderStatus;
    newStatus: OrderStatus;
    timestamp: Date;
  } = {
    orderId,
    action,
    performedBy,
    performedByRole,
    previousStatus,
    newStatus,
    timestamp: new Date()
  };

  // Only include optional fields if they have values
  if (notes !== undefined && notes !== null && notes.trim() !== '') {
    workflowAction.notes = notes;
  }
  if (reason !== undefined && reason !== null && reason.trim() !== '') {
    workflowAction.reason = reason;
  }
  if (metadata !== undefined && metadata !== null && Object.keys(metadata).length > 0) {
    workflowAction.metadata = metadata;
  }

  const docRef = await addDoc(collection(db, 'orderWorkflowActions'), workflowAction);
  return docRef.id;
}

/**
 * Create a new order
 */
export async function createOrder(orderData: Omit<Order, 'id' | 'orderId' | 'workflowHistory' | 'timestamps'>): Promise<string> {
  const orderId = await generateOrderId();
  const now = new Date();
  
  const order: Omit<Order, 'id'> = {
    ...orderData,
    orderId,
    workflowHistory: [],
    timestamps: {
      created: now,
      updated: now,
      submitted: now
    }
  };

  const docRef = await addDoc(collection(db, 'orders'), order);
  
  // Create initial workflow action
  await createWorkflowAction(
    orderId,
    'submit',
    orderData.exchangeId,
    'exchange',
    'submitted',
    'submitted',
    undefined,
    undefined,
    { source: orderData.source }
  );

  return docRef.id;
}

/**
 * Update order details (for editing submitted orders)
 */
export async function updateOrder(orderId: string, updates: Partial<Order>): Promise<boolean> {
  try {
    return await runTransaction(db, async (transaction) => {
      // Get current order
      const orderQuery = query(collection(db, 'orders'), where('orderId', '==', orderId));
      const orderSnapshot = await getDocs(orderQuery);
      
      if (orderSnapshot.empty) {
        throw new Error('Order not found');
      }

      const orderDoc = orderSnapshot.docs[0];
      const currentOrder = orderDoc.data() as Order;
      
      // Only allow editing submitted orders
      if (currentOrder.status !== 'submitted') {
        throw new Error('Only submitted orders can be edited');
      }

      // Prepare updates with timestamp
      const orderUpdates: Partial<Order> = {
        ...updates,
        timestamps: {
          ...currentOrder.timestamps,
          updated: new Date()
        }
      };

      // Update order
      transaction.update(orderDoc.ref, orderUpdates);

      // Create workflow action for the edit
      const workflowActionRef = doc(collection(db, 'orderWorkflowActions'));
      const workflowAction: Omit<OrderWorkflowAction, 'id'> = {
        orderId,
        action: 'edit',
        performedBy: updates.editedBy || 'unknown',
        performedByRole: 'exchange',
        previousStatus: currentOrder.status,
        newStatus: currentOrder.status,
        notes: 'Order details updated',
        timestamp: new Date()
      };
      
      transaction.set(workflowActionRef, workflowAction);

      return true;
    });
  } catch (error) {
    console.error('Error updating order:', error);
    return false;
  }
}

/**
 * Update order status with workflow tracking
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  performedBy: string,
  performedByRole: 'admin' | 'exchange',
  notes?: string,
  reason?: string,
  additionalUpdates?: Partial<Order>
): Promise<boolean> {
  try {
    return await runTransaction(db, async (transaction) => {
      // Get current order
      const orderQuery = query(collection(db, 'orders'), where('orderId', '==', orderId));
      const orderSnapshot = await getDocs(orderQuery);
      
      if (orderSnapshot.empty) {
        throw new Error('Order not found');
      }

      const orderDoc = orderSnapshot.docs[0];
      const currentOrder = orderDoc.data() as Order;
      
      // Validate status transition
      if (!isValidStatusTransition(currentOrder.status, newStatus, performedByRole)) {
        throw new Error(`Invalid status transition from ${currentOrder.status} to ${newStatus} for ${performedByRole}`);
      }

      // Prepare updates
      const updates: Partial<Order> = {
        ...(additionalUpdates || {}),
        status: newStatus,
        timestamps: {
          ...currentOrder.timestamps,
          updated: new Date(),
          [newStatus]: new Date()
        }
      };

      // Update order
      transaction.update(orderDoc.ref, updates);

      // Create workflow action
      const workflowActionRef = doc(collection(db, 'orderWorkflowActions'));
      const workflowAction: Partial<Omit<OrderWorkflowAction, 'id'>> & {
        orderId: string;
        action: OrderAction;
        performedBy: string;
        performedByRole: 'admin' | 'exchange';
        previousStatus: OrderStatus;
        newStatus: OrderStatus;
        timestamp: Date;
      } = {
        orderId,
        action: getActionFromStatusTransition(currentOrder.status, newStatus),
        performedBy,
        performedByRole,
        previousStatus: currentOrder.status,
        newStatus,
        timestamp: new Date()
      };

      // Only include optional fields if they have values
      if (notes !== undefined && notes !== null && notes.trim() !== '') {
        workflowAction.notes = notes;
      }
      if (reason !== undefined && reason !== null && reason.trim() !== '') {
        workflowAction.reason = reason;
      }
      
      transaction.set(workflowActionRef, workflowAction);

      return true;
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return false;
  }
}

/**
 * Get action type from status transition
 */
function getActionFromStatusTransition(fromStatus: OrderStatus, toStatus: OrderStatus): OrderAction {
  if (toStatus === 'pending_review') return 'submit';
  if (toStatus === 'approved') return 'approve';
  if (toStatus === 'rejected') return 'reject';
  if (toStatus === 'processing') return 'process';
  if (toStatus === 'completed') return 'complete';
  if (toStatus === 'cancelled') return 'cancel';
  if (toStatus === 'cancellation_requested') return 'request_cancellation';
  return 'edit';
}

/**
 * Get orders with filtering, sorting, and pagination
 * Uses simplified queries to avoid complex index requirements
 */
export async function getOrders(
  filters: OrderFilters = {},
  sortOptions: OrderSortOptions = { field: 'created', direction: 'desc' },
  pagination: PaginationOptions = { page: 1, limit: 10 }
): Promise<PaginatedResponse<Order>> {
  try {
    const q = collection(db, 'orders');
    const constraints: ReturnType<typeof where | typeof orderBy | typeof limit | typeof startAfter>[] = [];

    // Prioritize single most important filter to avoid complex indices
    // Apply only ONE filter at a time to reduce index requirements
    let primaryFilter: ReturnType<typeof where> | null = null;
    
    if (filters.exchangeId?.length === 1) {
      primaryFilter = where('exchangeId', '==', filters.exchangeId[0]);
    } else if (filters.status?.length === 1) {
      primaryFilter = where('status', '==', filters.status[0]);
    } else if (filters.type?.length === 1) {
      primaryFilter = where('type', '==', filters.type[0]);
    } else if (filters.status?.length && filters.status.length <= 10) {
      primaryFilter = where('status', 'in', filters.status);
    } else if (filters.type?.length && filters.type.length <= 10) {
      primaryFilter = where('type', 'in', filters.type);
    }

    if (primaryFilter) {
      constraints.push(primaryFilter);
    }

    // Add date range filter if specified
    if (filters.dateRange) {
      constraints.push(where('timestamps.created', '>=', filters.dateRange.start));
      constraints.push(where('timestamps.created', '<=', filters.dateRange.end));
    }

    // Apply sorting - only on timestamp fields to minimize index requirements
    const sortField = sortOptions.field === 'updated' ? 'timestamps.updated' : 'timestamps.created';
    constraints.push(orderBy(sortField, sortOptions.direction));

    // Apply pagination
    constraints.push(limit(pagination.limit));
    
    if (pagination.page > 1) {
      try {
        // Get the last document from previous page
        const prevPageQuery = query(q, ...constraints.slice(0, -1), limit((pagination.page - 1) * pagination.limit));
        const prevPageSnapshot = await getDocs(prevPageQuery);
        if (!prevPageSnapshot.empty) {
          const lastDoc = prevPageSnapshot.docs[prevPageSnapshot.docs.length - 1];
          constraints.push(startAfter(lastDoc));
        }
      } catch (paginationError) {
        console.warn('Pagination error, using page 1:', paginationError);
        // Fallback to page 1 if pagination fails
      }
    }

    const finalQuery = query(q, ...constraints);
    const snapshot = await getDocs(finalQuery);
    
    let items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Order[];

    // Apply additional filters in memory (client-side filtering)
    if (filters.exchangeId?.length && !primaryFilter) {
      items = items.filter(order => filters.exchangeId!.includes(order.exchangeId));
    }
    if (filters.priority?.length) {
      items = items.filter(order => filters.priority!.includes(order.priority));
    }
    if (filters.assignedAdmin) {
      items = items.filter(order => order.assignedAdmin === filters.assignedAdmin);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      items = items.filter(order => 
        order.orderId.toLowerCase().includes(searchLower) ||
        order.submittedAmount.toString().includes(searchLower) ||
        (order.recipientDetails?.name?.toLowerCase().includes(searchLower)) ||
        (order.senderDetails?.name?.toLowerCase().includes(searchLower))
      );
    }

    // Get approximate total count (simplified)
    let total = items.length;
    try {
      if (pagination.page === 1) {
        // Only get total count on first page to avoid expensive queries
        const countQuery = query(q, ...(primaryFilter ? [primaryFilter] : []), orderBy(sortField, 'desc'));
        const countSnapshot = await getDocs(countQuery);
        total = countSnapshot.size;
      } else {
        // Estimate total for other pages
        total = (pagination.page - 1) * pagination.limit + items.length;
      }
    } catch (countError) {
      console.warn('Count query failed, using items length:', countError);
      total = items.length;
    }

    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
      hasNext: items.length === pagination.limit,
      hasPrevious: pagination.page > 1
    };
  } catch (error) {
    console.error('Error getting orders:', error);
    
    // Fallback: try the simplest possible query without any complex constraints
    try {
      console.log('Attempting ultra-simple fallback query...');
      
      // Try the absolute simplest query possible
      const simplestQuery = query(
        collection(db, 'orders'),
        limit(Math.min(pagination.limit, 5)) // Limit to 5 items during index building
      );
      const simplestSnapshot = await getDocs(simplestQuery);
      const simplestItems = simplestSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];

      // Apply basic filtering in memory
      let filteredItems = simplestItems;
      if (filters.exchangeId?.length) {
        filteredItems = filteredItems.filter(order => 
          filters.exchangeId!.includes(order.exchangeId)
        );
      }

      return {
        items: filteredItems,
        total: filteredItems.length,
        page: 1,
        limit: pagination.limit,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false
      };
    } catch (fallbackError) {
      console.error('Even simplest query failed:', fallbackError);
      
      // If all queries fail, return empty state with helpful message
      if (fallbackError instanceof Error && fallbackError.message.includes('index')) {
        throw new Error('Firebase indices are still building. This usually takes 5-15 minutes. Please wait and refresh the page in a few minutes.');
      }
      throw new Error('Unable to load orders. Firebase indices may still be building.');
    }
  }
}

/**
 * Get order by ID or order ID
 */
export async function getOrder(identifier: string): Promise<Order | null> {
  try {
    // First try by document ID
    const docRef = doc(db, 'orders', identifier);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Order;
    }

    // Then try by orderId field
    const q = query(collection(db, 'orders'), where('orderId', '==', identifier));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Order;
    }

    return null;
  } catch (error) {
    console.error('Error getting order:', error);
    throw error;
  }
}

/**
 * Get order statistics for a given period
 * Uses simplified queries during index building period
 */
export async function getOrderStatistics(
  startDate: Date, 
  endDate: Date, 
  exchangeId?: string
): Promise<OrderStatistics> {
  try {
    // Try a simple query first - get more orders and be less restrictive
    const simpleQuery = query(
      collection(db, 'orders'),
      limit(200) // Increased limit to get more orders
    );
    
    const snapshot = await getDocs(simpleQuery);
    let orders = snapshot.docs.map(doc => doc.data() as Order);
    
    // Apply filtering in memory
    if (exchangeId) {
      orders = orders.filter(order => order.exchangeId === exchangeId);
    }
    
    // Filter by date range in memory - make it less restrictive for now
    // Comment out strict date filtering to capture all orders
    // orders = orders.filter(order => {
    //   const orderDate = order.timestamps.created instanceof Date 
    //     ? order.timestamps.created 
    //     : new Date(order.timestamps.created);
    //   return orderDate >= startDate && orderDate <= endDate;
    // });
    
    const stats: OrderStatistics = {
      totalOrders: orders.length,
      ordersByStatus: orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<OrderStatus, number>),
      ordersByType: orders.reduce((acc, order) => {
        acc[order.type] = (acc[order.type] || 0) + 1;
        return acc;
      }, {} as Record<OrderType, number>),
      totalVolume: orders.reduce((sum, order) => sum + order.submittedAmount, 0),
      totalCommission: orders.reduce((sum, order) => sum + order.commission, 0),
      averageOrderValue: orders.length > 0 ? orders.reduce((sum, order) => sum + order.submittedAmount, 0) / orders.length : 0,
      processingTime: calculateProcessingTimeStats(orders),
      period: {
        startDate,
        endDate
      }
    };

    return stats;
  } catch (error) {
    console.error('Error getting order statistics:', error);
    
    // Return empty statistics during index building
    if (error instanceof Error && error.message.includes('index')) {
      console.warn('Returning empty statistics while indices are building');
      return {
        totalOrders: 0,
        ordersByStatus: {
          submitted: 0,
          pending_review: 0,
          approved: 0,
          rejected: 0,
          processing: 0,
          completed: 0,
          cancelled: 0,
          cancellation_requested: 0
        },
        ordersByType: {
          incoming: 0,
          outgoing: 0
        },
        totalVolume: 0,
        totalCommission: 0,
        averageOrderValue: 0,
        processingTime: { average: 0, median: 0, fastest: 0, slowest: 0 },
        period: { startDate, endDate }
      };
    }
    
    throw error;
  }
}

/**
 * Calculate processing time statistics
 */
function calculateProcessingTimeStats(orders: Order[]): OrderStatistics['processingTime'] {
  const completedOrders = orders.filter(order => 
    order.status === 'completed' && 
    order.timestamps.completed && 
    order.timestamps.created
  );

  if (completedOrders.length === 0) {
    return { average: 0, median: 0, fastest: 0, slowest: 0 };
  }

  const processingTimes = completedOrders.map(order => {
    const created = new Date(order.timestamps.created).getTime();
    const completed = new Date(order.timestamps.completed!).getTime();
    return Math.round((completed - created) / (1000 * 60)); // minutes
  });

  processingTimes.sort((a, b) => a - b);

  return {
    average: Math.round(processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length),
    median: processingTimes[Math.floor(processingTimes.length / 2)],
    fastest: processingTimes[0],
    slowest: processingTimes[processingTimes.length - 1]
  };
}

/**
 * Add file to order
 */
export async function addOrderFile(
  orderId: string,
  fileData: Omit<OrderFile, 'id'>
): Promise<string> {
  try {
    // Add file document
    const fileRef = await addDoc(collection(db, 'orderFiles'), {
      ...fileData,
      orderId
    });

    // Update order to include file reference
    const orderQuery = query(collection(db, 'orders'), where('orderId', '==', orderId));
    const orderSnapshot = await getDocs(orderQuery);
    
    if (!orderSnapshot.empty) {
      const orderDoc = orderSnapshot.docs[0];
      const currentOrder = orderDoc.data() as Order;
      
      const updatedFiles = fileData.category === 'screenshot' 
        ? [...(currentOrder.screenshots || []), { id: fileRef.id, ...fileData }]
        : [...(currentOrder.documents || []), { id: fileRef.id, ...fileData }];

      await updateDoc(orderDoc.ref, {
        [fileData.category === 'screenshot' ? 'screenshots' : 'documents']: updatedFiles,
        'timestamps.updated': new Date()
      });
    }

    return fileRef.id;
  } catch (error) {
    console.error('Error adding order file:', error);
    throw error;
  }
}

/**
 * Bulk update order statuses (admin function)
 */
export async function bulkUpdateOrderStatus(
  orderIds: string[],
  newStatus: OrderStatus,
  performedBy: string,
  notes?: string
): Promise<{ success: string[], failed: string[] }> {
  const batch = writeBatch(db);
  const success: string[] = [];
  const failed: string[] = [];

  try {
    // Process in batches of 500 (Firestore limit)
    const batchSize = 500;
    for (let i = 0; i < orderIds.length; i += batchSize) {
      const batchOrderIds = orderIds.slice(i, i + batchSize);
      
      for (const orderId of batchOrderIds) {
        try {
          const orderQuery = query(collection(db, 'orders'), where('orderId', '==', orderId));
          const orderSnapshot = await getDocs(orderQuery);
          
          if (orderSnapshot.empty) {
            failed.push(orderId);
            continue;
          }

          const orderDoc = orderSnapshot.docs[0];
          const currentOrder = orderDoc.data() as Order;
          
          if (!isValidStatusTransition(currentOrder.status, newStatus, 'admin')) {
            failed.push(orderId);
            continue;
          }

          // Update order
          batch.update(orderDoc.ref, {
            status: newStatus,
            'timestamps.updated': new Date(),
            [`timestamps.${newStatus}`]: new Date(),
            adminNotes: notes
          });

          success.push(orderId);
        } catch (error) {
          console.error(`Error processing order ${orderId}:`, error);
          failed.push(orderId);
        }
      }
      
      // Commit this batch
      await batch.commit();
    }

    return { success, failed };
  } catch (error) {
    console.error('Error in bulk update:', error);
    throw error;
  }
} 