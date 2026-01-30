
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useBusinessPassword } from '@/components/hooks/useBusinessPassword';
import { dataStore } from '@/lib/dataStore';
import { BusinessLocation } from '@/components/types/index';

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
  const { isBusinessVerified } = useBusinessPassword();

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

      const data = await dataStore.getBusinessLocations(user.id);

      setBusinessLocations(data || []);

      // Always try to set a current business if we have locations
      if (data && data.length > 0) {
        // First check localStorage for saved business
        const savedBusinessId = typeof window !== 'undefined' ? localStorage.getItem('currentBusinessId') : null;
        let businessToSet = data.find(b => b.id === savedBusinessId);

        // If no saved business or saved business not found, use default or first
        if (!businessToSet) {
          businessToSet = data.find(b => b.is_default) || data[0];
        }

        if (businessToSet) {
          setCurrentBusiness(businessToSet);
          if (typeof window !== 'undefined') {
            localStorage.setItem('currentBusinessId', businessToSet.id);
          }
        }
      } else {
        // No business locations found, clear current business
        setCurrentBusiness(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('currentBusinessId');
        }
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

    // If business has password protection and is not verified in this session
    if (business.switch_password_hash && !isBusinessVerified(businessId)) {
      if (onPasswordPrompt) {
        onPasswordPrompt(businessId, business.name, () => {
          // This callback is called after successful password verification
          setCurrentBusiness(business);
          localStorage.setItem('currentBusinessId', business.id);
        });
        return;
      } else {
        console.warn('Password required but no prompt handler provided');
        return;
      }
    }

    // No password protection or already verified
    setCurrentBusiness(business);
    localStorage.setItem('currentBusinessId', business.id);
  };

  const createBusiness = async (name: string): Promise<BusinessLocation | null> => {
    if (!user) {
      console.error('No user found when creating business');
      return null;
    }

    try {
      const newBusiness = await dataStore.createBusiness({
        id: `loc-${Date.now()}`,
        name: name.trim(),
        is_default: businessLocations.length === 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      if (newBusiness) {
        setBusinessLocations(prev => [...prev, newBusiness]);

        // If this is the first business or it's set as default, make it current
        if (businessLocations.length === 0 || newBusiness.is_default) {
          setCurrentBusiness(newBusiness);
          localStorage.setItem('currentBusinessId', newBusiness.id);
        }

        return newBusiness;
      }

      return null;
    } catch (error) {
      console.error('Error creating business:', error);
      return null;
    }
  };

  const updateBusiness = async (id: string, name: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const updatedBusiness = await dataStore.updateBusiness(id, { name });

      if (updatedBusiness) {
        setBusinessLocations(prev => prev.map(b => b.id === id ? updatedBusiness : b));

        if (currentBusiness?.id === id) {
          setCurrentBusiness(updatedBusiness);
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error updating business:', error);
      return false;
    }
  };

  const deleteBusiness = async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const success = await dataStore.deleteBusiness(id);
      if (!success) throw new Error("Failed to delete");

      setBusinessLocations(prev => prev.filter(b => b.id !== id));

      // If deleted business was current, switch to default or first available
      if (currentBusiness?.id === id) {
        const remaining = businessLocations.filter(b => b.id !== id);
        const defaultBusiness = remaining.find(b => b.is_default);
        const nextBusiness = defaultBusiness || remaining[0] || null;

        setCurrentBusiness(nextBusiness);
        if (nextBusiness) {
          localStorage.setItem('currentBusinessId', nextBusiness.id);
        } else {
          localStorage.removeItem('currentBusinessId');
        }
      }

      return true;
    } catch (error) {
      console.error('Error deleting business:', error);
      return false;
    }
  };

  const resetBusiness = async (id: string): Promise<boolean> => {
    if (!user) {
      console.error('No user found when resetting business');
      return false;
    }

    try {
      // Mock reset
      await new Promise(r => setTimeout(r, 500));

      // Reload business locations to refresh the data
      await loadBusinessLocations();

      return true;
    } catch (error) {
      console.error('Error resetting business:', error);
      return false;
    }
  };

  useEffect(() => {
    if (user) {
      loadBusinessLocations();
    } else {
      setCurrentBusiness(null);
      setBusinessLocations([]);
      setIsLoading(false);
      setError(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('currentBusinessId');
      }
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
