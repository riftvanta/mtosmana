'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AuthUser, LoginCredentials } from '@/types';
import { authenticateUser, createDefaultAdmin } from '@/lib/auth';

// Performance: Separate context for auth state to prevent unnecessary re-renders
const AuthStateContext = createContext<{ user: AuthUser | null; loading: boolean } | undefined>(undefined);
const AuthActionsContext = createContext<{ 
  login: (credentials: LoginCredentials) => Promise<boolean>; 
  logout: () => Promise<void> 
} | undefined>(undefined);

export const useAuth = () => {
  const state = useContext(AuthStateContext);
  const actions = useContext(AuthActionsContext);
  
  if (state === undefined || actions === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return { ...state, ...actions };
};

export const useRequireAuth = (redirectTo = '/login') => {
  const auth = useAuth();
  
  useEffect(() => {
    if (!auth.loading && !auth.user) {
      window.location.href = redirectTo;
    }
  }, [auth.loading, auth.user, redirectTo]);
  
  return auth;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

// Cache for user session validation
let sessionCache: { user: AuthUser | null; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Optimized login function with better error handling
  const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      const user = await authenticateUser(credentials);
      if (user) {
        setUser(user);
        
        // Cache the session
        sessionCache = {
          user: user,
          timestamp: Date.now()
        };
        
        // Persist in localStorage
        localStorage.setItem('auth_user', JSON.stringify(user));
        return true;
      } else {
        console.warn('Authentication failed');
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  // Optimized logout function
  const logout = useCallback(async (): Promise<void> => {
    try {
      setUser(null);
      sessionCache = null;
      localStorage.removeItem('auth_user');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  // Optimized session validation
  const validateSession = useCallback(async (userData: AuthUser): Promise<boolean> => {
    // Check cache first
    if (sessionCache && 
        sessionCache.user?.id === userData.id && 
        Date.now() - sessionCache.timestamp < CACHE_DURATION) {
      return true;
    }

    // Validate required fields
    if (!userData.id || !userData.username || !userData.role) {
      return false;
    }

    // Update cache
    sessionCache = {
      user: userData,
      timestamp: Date.now()
    };

    return true;
  }, []);

  // Optimized auth check with debouncing
  const checkAuth = useCallback(async () => {
    try {
      const storedUser = localStorage.getItem('auth_user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        
        // Validate session
        const isValid = await validateSession(parsedUser);
        if (isValid) {
          setUser(parsedUser);
        } else {
          // Clear invalid session
          localStorage.removeItem('auth_user');
          sessionCache = null;
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      localStorage.removeItem('auth_user');
      sessionCache = null;
    } finally {
      setLoading(false);
    }
  }, [validateSession]);

  // Initialize app with optimized async loading
  useEffect(() => {
    let mounted = true;

    const initializeApp = async () => {
      try {
        // Initialize default admin (non-blocking)
        createDefaultAdmin().catch(console.warn);
        
        // Check authentication
        if (mounted) {
          await checkAuth();
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeApp();

    return () => {
      mounted = false;
    };
  }, [checkAuth]);

  // Memoized context values to prevent unnecessary re-renders
  const authState = useMemo(() => ({
    user,
    loading
  }), [user, loading]);

  const authActions = useMemo(() => ({
    login,
    logout
  }), [login, logout]);

  // Performance: Split context providers to minimize re-renders
  return (
    <AuthStateContext.Provider value={authState}>
      <AuthActionsContext.Provider value={authActions}>
        {children}
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
};

// Performance hook for components that only need user state
export const useAuthState = () => {
  const context = useContext(AuthStateContext);
  if (context === undefined) {
    throw new Error('useAuthState must be used within an AuthProvider');
  }
  return context;
};

// Performance hook for components that only need auth actions
export const useAuthActions = () => {
  const context = useContext(AuthActionsContext);
  if (context === undefined) {
    throw new Error('useAuthActions must be used within an AuthProvider');
  }
  return context;
}; 