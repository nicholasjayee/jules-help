
import { useState } from 'react';
import { useToast } from '@/components/hooks/use-toast';
import { dataStore } from '@/lib/dataStore';

export const useBusinessPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Session storage key for verified businesses
  const VERIFIED_BUSINESSES_KEY = 'verified_businesses';

  const getVerifiedBusinesses = (): Set<string> => {
    try {
      if (typeof window === 'undefined') return new Set();
      const stored = sessionStorage.getItem(VERIFIED_BUSINESSES_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  const setBusinessVerified = (businessId: string) => {
    try {
      if (typeof window === 'undefined') return;
      const verified = getVerifiedBusinesses();
      verified.add(businessId);
      sessionStorage.setItem(VERIFIED_BUSINESSES_KEY, JSON.stringify(Array.from(verified)));
    } catch (error) {
      console.error('Error storing verified business:', error);
    }
  };

  const isBusinessVerified = (businessId: string): boolean => {
    return getVerifiedBusinesses().has(businessId);
  };

  const clearVerifiedBusinesses = () => {
    try {
      if (typeof window === 'undefined') return;
      sessionStorage.removeItem(VERIFIED_BUSINESSES_KEY);
    } catch (error) {
      console.error('Error clearing verified businesses:', error);
    }
  };

  const setBusinessPassword = async (businessId: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      console.log('Setting password for business:', businessId);
      
      // Mock password hashing
      await dataStore.updateBusiness(businessId, { switch_password_hash: 'hashed_' + password });

      toast({
        title: "Password Set Successfully",
        description: "Your business is now password protected.",
      });
      return true;
    } catch (error) {
      console.error('Error setting business password:', error);
      toast({
        title: "Failed to Set Password",
        description: "An unexpected error occurred. Please try again later.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyBusinessPassword = async (businessId: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      console.log('Verifying password for business:', businessId);
      
      // Mock verification
      await new Promise(resolve => setTimeout(resolve, 500));

      const isVerified = true; // Always true for dummy mode
      
      if (isVerified) {
        setBusinessVerified(businessId);
        console.log('Password verified successfully for business:', businessId);
      }

      return isVerified;
    } catch (error) {
      console.error('Error verifying business password:', error);
      toast({
        title: "Verification Error",
        description: "An unexpected error occurred during verification.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const removeBusinessPassword = async (businessId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await dataStore.updateBusiness(businessId, { switch_password_hash: undefined }); // or null/undefined

      // Remove from verified list since password is removed
      const verified = getVerifiedBusinesses();
      verified.delete(businessId);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(VERIFIED_BUSINESSES_KEY, JSON.stringify(Array.from(verified)));
      }

      return true;
    } catch (error) {
      console.error('Error removing business password:', error);
      toast({
        title: "Failed to Remove Password",
        description: "Please try again later.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    setBusinessPassword,
    verifyBusinessPassword,
    removeBusinessPassword,
    isBusinessVerified,
    setBusinessVerified,
    clearVerifiedBusinesses,
  };
};
