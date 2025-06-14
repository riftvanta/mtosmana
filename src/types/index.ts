// User Types
export type UserRole = 'admin' | 'exchange';

// Commission Types
export type CommissionType = 'fixed' | 'percentage';

export interface CommissionRate {
  type: CommissionType;
  value: number;
}

export interface User {
  id: string;
  username: string;
  password: string; // hashed
  role: UserRole;
  exchangeName?: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  };
  balance: number;
  commissionRates: {
    incoming: CommissionRate; // can be fixed JOD or percentage
    outgoing: CommissionRate; // can be fixed JOD or percentage
  };
  assignedBanks: string[]; // array of bank IDs
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
  // Additional user properties for enhanced functionality
  lastLoginAt?: Date;
  loginCount?: number;
  isOnline?: boolean;
  lastActivity?: Date;
  preferences?: {
    notifications: boolean;
    language: 'en' | 'ar';
    theme: 'light' | 'dark';
  };
}

// Enhanced Order Types
export type OrderType = 'incoming' | 'outgoing';
export type OrderStatus = 
  | 'submitted' 
  | 'pending_review' 
  | 'approved' 
  | 'rejected' 
  | 'processing' 
  | 'completed' 
  | 'cancelled'
  | 'cancellation_requested';

// Order Priority for admin dashboard
export type OrderPriority = 'low' | 'normal' | 'high' | 'urgent';

// Order workflow action types
export type OrderAction = 
  | 'submit'
  | 'approve' 
  | 'reject'
  | 'process'
  | 'complete'
  | 'cancel'
  | 'request_cancellation'
  | 'edit'
  | 'add_note'
  | 'upload_screenshot';

export interface OrderWorkflowAction {
  id: string;
  orderId: string;
  action: OrderAction;
  performedBy: string; // user ID
  performedByRole: UserRole;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  notes?: string;
  reason?: string;
  timestamp: Date;
  metadata?: Record<string, string | number | boolean>;
}

// Enhanced Order interface
export interface Order {
  id: string;
  orderId: string; // custom format: TYYMMXXXX
  exchangeId: string; // reference to user
  type: OrderType;
  status: OrderStatus;
  priority: OrderPriority;
  submittedAmount: number;
  finalAmount?: number; // for incoming orders
  commission: number;
  commissionRate: CommissionRate; // snapshot of rate at time of order
  netAmount: number; // calculated final amount after commission
  
  // CliQ Details for outgoing transfers
  cliqDetails?: {
    aliasName?: string;
    mobileNumber?: string; // validated Jordanian number
    description?: string;
  };
  
  // Recipient details
  recipientDetails?: {
    name?: string;
    bankName?: string;
    accountNumber?: string;
    notes?: string;
  };
  
  // Sender details for incoming transfers
  senderDetails?: {
    name?: string;
    bankName?: string;
    reference?: string;
  };
  
  // Bank information
  bankUsed?: string; // for incoming transfers (from assigned banks)
  platformBankUsed?: string; // for outgoing orders
  
  // File management
  screenshots: OrderFile[];
  documents: OrderFile[]; // additional supporting documents
  
  // Admin management
  adminNotes?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  assignedAdmin?: string; // admin user ID handling this order
  
  // Workflow tracking
  workflowHistory: OrderWorkflowAction[];
  
  // Real-time tracking
  isBeingEdited?: boolean;
  editedBy?: string;
  lastEditAt?: Date;
  
  // Timestamps
  timestamps: {
    created: Date;
    updated: Date;
    submitted: Date;
    approved?: Date;
    rejected?: Date;
    processing?: Date;
    completed?: Date;
    cancelled?: Date;
  };
  
  // Additional metadata
  source: 'web' | 'mobile' | 'api';
  ipAddress?: string;
  userAgent?: string;
  tags?: string[];
  internalReference?: string;
}

// Order File Management
export interface OrderFile {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  url: string;
  thumbnailUrl?: string;
  uploadedBy: string;
  uploadedByRole: UserRole;
  uploadedAt: Date;
  description?: string;
  category: 'screenshot' | 'document' | 'receipt' | 'other';
  isRequired: boolean;
  status: 'uploading' | 'uploaded' | 'verified' | 'rejected';
  rejectionReason?: string;
}

// Order Statistics and Reporting
export interface OrderStatistics {
  totalOrders: number;
  ordersByStatus: Record<OrderStatus, number>;
  ordersByType: Record<OrderType, number>;
  totalVolume: number;
  totalCommission: number;
  averageOrderValue: number;
  processingTime: {
    average: number; // in minutes
    median: number;
    fastest: number;
    slowest: number;
  };
  period: {
    startDate: Date;
    endDate: Date;
  };
}

// Order Filters for admin dashboard
export interface OrderFilters {
  status?: OrderStatus[];
  type?: OrderType[];
  exchangeId?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  amountRange?: {
    min: number;
    max: number;
  };
  priority?: OrderPriority[];
  search?: string; // search in order ID, amounts, names
  assignedAdmin?: string;
  bankUsed?: string[];
  tags?: string[];
}

// Order sorting options
export interface OrderSortOptions {
  field: 'orderId' | 'created' | 'updated' | 'amount' | 'status' | 'priority';
  direction: 'asc' | 'desc';
}

// Enhanced Bank Types
export interface PlatformBank {
  id: string;
  name: string;
  cliqDetails: {
    type: 'alias' | 'mobile';
    value: string; // Either alias name or mobile number
  };
  accountHolder: string;
  balance: number;
  isActive: boolean;
  description?: string;
  // Enhanced fields
  accountNumber?: string;
  branch?: string;
  dailyLimit?: number;
  monthlyLimit?: number;
  currentDailyUsage?: number;
  currentMonthlyUsage?: number;
  lastTransactionAt?: Date;
  maintenanceMode?: boolean;
  priority: number; // for ordering in selection
  fees?: {
    incoming: number;
    outgoing: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface BankAssignment {
  id: string;
  exchangeId: string; // reference to exchange user
  bankId: string; // reference to platform bank
  assignmentType: 'private' | 'public'; // private = only this exchange, public = shared
  isActive: boolean;
  priority: number; // for ordering in selection
  dailyLimit?: number;
  monthlyLimit?: number;
  restrictions?: {
    maxAmount?: number;
    minAmount?: number;
    allowedHours?: {
      start: string; // "09:00"
      end: string; // "17:00"
    };
    allowedDays?: number[]; // 0-6, Sunday = 0
  };
  assignedAt: Date;
  assignedBy: string; // admin user ID
  lastUsedAt?: Date;
  usageCount?: number;
}

// Legacy Bank interface for backward compatibility
export interface Bank {
  id: string;
  name: string;
  accountNumber?: string;
  accountHolder?: string;
  type: 'platform' | 'assigned';
  isActive: boolean;
  balance?: number; // for platform banks
}

// Enhanced Message Types for Real-time Chat
export interface Message {
  id: string;
  orderId: string;
  senderId: string;
  senderRole: UserRole;
  senderName: string;
  content: string;
  type: 'user' | 'system' | 'file' | 'status_change';
  timestamp: Date;
  // Enhanced fields
  edited?: boolean;
  editedAt?: Date;
  replyTo?: string; // message ID being replied to
  attachments?: OrderFile[];
  metadata?: {
    statusChange?: {
      from: OrderStatus;
      to: OrderStatus;
      reason?: string;
    };
    systemAction?: {
      action: OrderAction;
      details?: Record<string, string | number | boolean>;
    };
  };
  readBy: Array<{
    userId: string;
    readAt: Date;
  }>;
  reactions?: Array<{
    userId: string;
    type: 'like' | 'dislike' | 'important';
    timestamp: Date;
  }>;
}

// Chat/Conversation management
export interface Conversation {
  id: string;
  orderId: string;
  participants: Array<{
    userId: string;
    role: UserRole;
    name: string;
    joinedAt: Date;
    leftAt?: Date;
  }>;
  lastMessage?: Message;
  unreadCount: Record<string, number>; // userId -> count
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Real-time Notification System
export type NotificationType = 
  | 'order_created'
  | 'order_status_changed'
  | 'order_approved'
  | 'order_rejected'
  | 'order_completed'
  | 'order_cancelled'
  | 'new_message'
  | 'balance_updated'
  | 'system_alert'
  | 'assignment_changed'
  | 'maintenance_mode';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string;
  relatedEntityId?: string; // for banks, users, etc.
  priority: 'low' | 'normal' | 'high' | 'critical';
  isRead: boolean;
  readAt?: Date;
  actionUrl?: string;
  actionText?: string;
  metadata?: Record<string, string | number | boolean>;
  expiresAt?: Date;
  createdAt: Date;
}

// Real-time activity tracking
export interface ActivityLog {
  id: string;
  userId: string;
  userRole: UserRole;
  userName: string;
  action: string;
  resource: 'order' | 'user' | 'bank' | 'system';
  resourceId?: string;
  details: Record<string, string | number | boolean>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

// Authentication Types
export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  exchangeName?: string;
  permissions?: string[];
  sessionId?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  checkPermission: (permission: string) => boolean;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
  };
}

// Pagination
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Enhanced File Upload Types
export interface FileUpload {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  url?: string;
  error?: string;
  id?: string;
  orderId?: string;
  category?: OrderFile['category'];
}

export interface FileUploadOptions {
  maxSize: number; // in bytes
  allowedTypes: string[];
  maxFiles: number;
  category: OrderFile['category'];
  required: boolean;
  description?: string;
}

// System Configuration
export interface SystemConfig {
  orderIdPrefix: string;
  maxFileSize: number;
  allowedFileTypes: string[];
  commissionLimits: {
    maxPercentage: number;
    maxFixed: number;
  };
  orderLimits: {
    maxDailyAmount: number;
    maxSingleAmount: number;
    maxPendingOrders: number;
  };
  workingHours: {
    start: string;
    end: string;
    timezone: string;
  };
  maintenanceMode: boolean;
  features: {
    realTimeChat: boolean;
    fileUpload: boolean;
    pushNotifications: boolean;
    orderTracking: boolean;
  };
}

// Dashboard Analytics
export interface DashboardStats {
  orders: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    pending: number;
    processing: number;
  };
  volume: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  commission: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  exchanges: {
    active: number;
    inactive: number;
    online: number;
  };
  systemHealth: {
    uptime: number;
    responseTime: number;
    errorRate: number;
  };
}

// Real-time connection status
export interface ConnectionStatus {
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnectedAt?: Date;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
  latency?: number;
}

// Form validation types
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string | number) => string | null;
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'tel' | 'select' | 'textarea' | 'file';
  rules: ValidationRule[];
  placeholder?: string;
  options?: Array<{ value: string; label: string; }>;
  disabled?: boolean;
  hidden?: boolean;
}

export interface FormErrors {
  [fieldName: string]: string;
}

// Order ID generation
export interface OrderIdGenerator {
  prefix: string;
  year: number;
  month: number;
  sequence: number;
  timezone: string;
}

// Export commonly used type unions
export type OrderStatusFilter = OrderStatus | 'all';
export type OrderTypeFilter = OrderType | 'all';
export type UserStatusFilter = User['status'] | 'all';
export type NotificationPriority = Notification['priority'];
export type FileCategory = OrderFile['category'];
export type ActivitySeverity = ActivityLog['severity']; 