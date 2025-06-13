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
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

// Order Types
export type OrderType = 'incoming' | 'outgoing';
export type OrderStatus = 
  | 'submitted' 
  | 'pending_review' 
  | 'approved' 
  | 'rejected' 
  | 'processing' 
  | 'completed' 
  | 'cancelled';

export interface Order {
  id: string;
  orderId: string; // custom format: TYYMMXXXX
  exchangeId: string; // reference to user
  type: OrderType;
  status: OrderStatus;
  submittedAmount: number;
  finalAmount?: number; // for incoming orders
  commission: number;
  cliqDetails?: {
    aliasName?: string;
    mobileNumber?: string;
  };
  recipientDetails?: {
    name?: string;
    bankName?: string;
  };
  bankUsed?: string;
  platformBankUsed?: string; // for outgoing orders
  screenshots: string[]; // array of file URLs
  adminNotes?: string;
  rejectionReason?: string;
  timestamps: {
    created: Date;
    updated: Date;
    completed?: Date;
  };
}

// Bank Types
export interface Bank {
  id: string;
  name: string;
  accountNumber?: string;
  accountHolder?: string;
  type: 'platform' | 'assigned';
  isActive: boolean;
  balance?: number; // for platform banks
}

// Message Types
export interface Message {
  id: string;
  orderId: string;
  senderId: string;
  senderRole: UserRole;
  content: string;
  type: 'user' | 'system';
  timestamp: Date;
}

// Authentication Types
export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  exchangeName?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// File Upload Types
export interface FileUpload {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  url?: string;
  error?: string;
} 