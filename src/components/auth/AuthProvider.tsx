"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { DUMMY_USER_ID } from '@/lib/dummyData';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate checking auth session
    const timer = setTimeout(() => {
      setUser({
        id: DUMMY_USER_ID,
        email: 'dummy@example.com',
      });
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const signOut = async () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
