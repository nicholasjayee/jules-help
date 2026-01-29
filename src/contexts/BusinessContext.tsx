"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { getBusinessLocations } from '@/lib/dummyData';

export interface BusinessLocation {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  switch_password_hash?: string;
}

interface BusinessContextType {
  currentBusiness: BusinessLocation | null;
  businessLocations: BusinessLocation[];
  switchBusiness: (businessId: string, onPasswordPrompt?: (businessId: string, businessName: string, onVerified: () => void) => void) => void;
  loadBusinessLocations: () => Promise<void>;
  createBusiness: (name: string) => Promise<BusinessLocation | null>;
  updateBusiness: (id: string, name: string) => Promise<boolean>;
  deleteBusiness: (id: string) => Promise<boolean>;
  resetBusiness: (id: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
};

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentBusiness, setCurrentBusiness] = useState<BusinessLocation | null>(null);
  const [businessLocations, setBusinessLocations] = useState<BusinessLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBusinessLocations = async () => {
    if (!user) {
      setIsLoading(false);
      setError(null);
      setCurrentBusiness(null);
      setBusinessLocations([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await getBusinessLocations();

      setBusinessLocations(data || []);

      if (data && data.length > 0) {
        // First check localStorage for saved business
        const savedBusinessId = localStorage.getItem('currentBusinessId');
        let businessToSet = data.find(b => b.id === savedBusinessId);

        // If no saved business or saved business not found, use default or first
        if (!businessToSet) {
          businessToSet = data.find(b => b.is_default) || data[0];
        }

        if (businessToSet) {
          setCurrentBusiness(businessToSet);
          localStorage.setItem('currentBusinessId', businessToSet.id);
        }
      } else {
        setCurrentBusiness(null);
        localStorage.removeItem('currentBusinessId');
      }
    } catch (error) {
      console.error('Error loading business locations:', error);
      setError('Failed to load business data');
      setCurrentBusiness(null);
      setBusinessLocations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const switchBusiness = (businessId: string, onPasswordPrompt?: (businessId: string, businessName: string, onVerified: () => void) => void) => {
    const business = businessLocations.find(b => b.id === businessId);
    if (!business) {
      console.error('Business not found:', businessId);
      return;
    }
    // Logic for password removed
    setCurrentBusiness(business);
    localStorage.setItem('currentBusinessId', business.id);
  };

  const createBusiness = async (name: string): Promise<BusinessLocation | null> => {
    // Mock create
    const newBusiness: BusinessLocation = {
        id: `loc-${Date.now()}`,
        name,
        is_default: businessLocations.length === 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    setBusinessLocations(prev => [...prev, newBusiness]);
    if (newBusiness.is_default) {
        setCurrentBusiness(newBusiness);
        localStorage.setItem('currentBusinessId', newBusiness.id);
    }
    return newBusiness;
  };

  const updateBusiness = async (id: string, name: string): Promise<boolean> => {
    setBusinessLocations(prev => prev.map(b => b.id === id ? { ...b, name } : b));
    if (currentBusiness?.id === id) {
        setCurrentBusiness(prev => prev ? { ...prev, name } : null);
    }
    return true;
  };

  const deleteBusiness = async (id: string): Promise<boolean> => {
    setBusinessLocations(prev => prev.filter(b => b.id !== id));
    if (currentBusiness?.id === id) {
        const remaining = businessLocations.filter(b => b.id !== id);
        const next = remaining[0] || null;
        setCurrentBusiness(next);
        if (next) localStorage.setItem('currentBusinessId', next.id);
        else localStorage.removeItem('currentBusinessId');
    }
    return true;
  };

  const resetBusiness = async (id: string): Promise<boolean> => {
    return true; // Mock success
  };

  useEffect(() => {
    if (user) {
      loadBusinessLocations();
    } else {
      setCurrentBusiness(null);
      setBusinessLocations([]);
      setIsLoading(false);
      setError(null);
      localStorage.removeItem('currentBusinessId');
    }
  }, [user?.id]);

  return (
    <BusinessContext.Provider
      value={{
        currentBusiness,
        businessLocations,
        switchBusiness,
        loadBusinessLocations,
        createBusiness,
        updateBusiness,
        deleteBusiness,
        resetBusiness,
        isLoading,
        error
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
};
