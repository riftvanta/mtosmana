import bcrypt from 'bcryptjs';
import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { User, LoginCredentials, AuthUser } from '@/types';

// Password utilities
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

// Username validation
export const validateUsername = (username: string): boolean => {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
  return usernameRegex.test(username);
};

// Password validation
export const validatePassword = (password: string): boolean => {
  return password.length >= 6; // Basic validation, can be enhanced
};

// Check if Firebase is accessible
const isFirebaseAccessible = async (): Promise<boolean> => {
  try {
    const testCollection = collection(db, 'test');
    await getDocs(testCollection);
    return true;
  } catch (error) {
    console.warn('Firebase not accessible:', error);
    return false;
  }
};

// Fallback authentication for demo purposes when Firebase is not accessible
const fallbackAuth = async (credentials: LoginCredentials): Promise<AuthUser | null> => {
  const { username, password } = credentials;
  
  // Demo credentials for when Firebase is not available
  if (username === 'admin' && password === 'admin123') {
    return {
      id: 'demo-admin-id',
      username: 'admin',
      role: 'admin',
    };
  }
  
  if (username === 'exchange1' && password === 'exchange123') {
    return {
      id: 'demo-exchange-id',
      username: 'exchange1',
      role: 'exchange',
      exchangeName: 'Demo Exchange Office',
    };
  }
  
  return null;
};

// Database operations
export const findUserByUsername = async (username: string): Promise<User | null> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    const userData = doc.data();
    
    return {
      id: doc.id,
      username: userData.username,
      password: userData.password,
      role: userData.role,
      exchangeName: userData.exchangeName,
      contactInfo: userData.contactInfo,
      balance: userData.balance || 0,
      commissionRates: userData.commissionRates || { incoming: 0, outgoing: 0 },
      assignedBanks: userData.assignedBanks || [],
      status: userData.status || 'active',
      createdAt: userData.createdAt?.toDate() || new Date(),
      updatedAt: userData.updatedAt?.toDate() || new Date(),
    };
  } catch (error) {
    console.error('Error finding user:', error);
    return null;
  }
};

// Create default admin user (for initial setup)
export const createDefaultAdmin = async (): Promise<boolean> => {
  try {
    // Check if Firebase is accessible first
    const firebaseAccessible = await isFirebaseAccessible();
    if (!firebaseAccessible) {
      console.log('Firebase not accessible, skipping admin creation');
      return true; // Return true to continue with app initialization
    }

    // Check if admin already exists
    const existingAdmin = await findUserByUsername('admin');
    if (existingAdmin) {
      return true; // Admin already exists
    }

    const hashedPassword = await hashPassword('admin123'); // Change this in production
    
    const adminUser = {
      username: 'admin',
      password: hashedPassword,
      role: 'admin' as const,
      balance: 0,
      commissionRates: { incoming: 0, outgoing: 0 },
      assignedBanks: [],
      status: 'active' as const,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await addDoc(collection(db, 'users'), adminUser);
    console.log('Default admin user created');
    return true;
  } catch (error) {
    console.error('Error creating default admin:', error);
    return true; // Return true to continue with app initialization even if this fails
  }
};

// Authentication function
export const authenticateUser = async (credentials: LoginCredentials): Promise<AuthUser | null> => {
  try {
    const { username, password } = credentials;
    
    // Validate input
    if (!validateUsername(username) || !validatePassword(password)) {
      return null;
    }
    
    // Check if Firebase is accessible
    const firebaseAccessible = await isFirebaseAccessible();
    if (!firebaseAccessible) {
      console.warn('Firebase not accessible, using fallback authentication');
      return await fallbackAuth(credentials);
    }
    
    // Find user
    const user = await findUserByUsername(username);
    if (!user || user.status !== 'active') {
      return null;
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return null;
    }
    
    // Return auth user (without password)
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      exchangeName: user.exchangeName,
    };
  } catch (error) {
    console.error('Authentication error:', error);
    // Fallback to demo auth if Firebase fails
    console.warn('Falling back to demo authentication');
    return await fallbackAuth(credentials);
  }
};

// Create exchange user (admin function)
export const createExchangeUser = async (userData: {
  username: string;
  password: string;
  exchangeName: string;
  balance?: number;
  commissionRates?: { incoming: number; outgoing: number };
}): Promise<boolean> => {
  try {
    // Check if Firebase is accessible
    const firebaseAccessible = await isFirebaseAccessible();
    if (!firebaseAccessible) {
      console.warn('Firebase not accessible, cannot create exchange user');
      return false;
    }

    // Validate input
    if (!validateUsername(userData.username) || !validatePassword(userData.password)) {
      return false;
    }
    
    // Check if username already exists
    const existingUser = await findUserByUsername(userData.username);
    if (existingUser) {
      return false; // Username already taken
    }
    
    const hashedPassword = await hashPassword(userData.password);
    
    const exchangeUser = {
      username: userData.username,
      password: hashedPassword,
      role: 'exchange' as const,
      exchangeName: userData.exchangeName,
      balance: userData.balance || 0,
      commissionRates: userData.commissionRates || { incoming: 0, outgoing: 0 },
      assignedBanks: [],
      status: 'active' as const,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await addDoc(collection(db, 'users'), exchangeUser);
    return true;
  } catch (error) {
    console.error('Error creating exchange user:', error);
    return false;
  }
}; 