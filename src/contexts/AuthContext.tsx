'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, LoginCredentials, AuthContextType } from '@/types';
import { authenticateUser, createDefaultAdmin } from '@/lib/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize default admin user
    const initializeApp = async () => {
      try {
        await createDefaultAdmin();
      } catch (error) {
        console.error('Error initializing app:', error);
        // Continue with auth check even if admin creation fails
      }
    };

    // Check for existing session
    const checkAuth = async () => {
      try {
        const storedUser = localStorage.getItem('auth_user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          
          // Validate the stored user by checking if it has required fields
          if (parsedUser.id && parsedUser.username && parsedUser.role) {
            setUser(parsedUser);
          } else {
            // Invalid stored user data, clear it
            localStorage.removeItem('auth_user');
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        localStorage.removeItem('auth_user');
      } finally {
        setLoading(false);
      }
    };

    // Initialize app and check auth
    const initialize = async () => {
      await initializeApp();
      await checkAuth();
    };

    initialize();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      setLoading(true);
      const authUser = await authenticateUser(credentials);
      
      if (authUser) {
        setUser(authUser);
        localStorage.setItem('auth_user', JSON.stringify(authUser));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      // Clear any invalid stored user data on login error
      localStorage.removeItem('auth_user');
      setUser(null);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setUser(null);
      localStorage.removeItem('auth_user');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 