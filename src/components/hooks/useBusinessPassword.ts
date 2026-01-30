import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useBusinessPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Session storage key for verified businesses
  const VERIFIED_BUSINESSES_KEY = 'verified_businesses';

  const getVerifiedBusinesses = (): Set<string> => {
    try {
      const stored = sessionStorage.getItem(VERIFIED_BUSINESSES_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  const setBusinessVerified = (businessId: string) => {
    try {
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
      sessionStorage.removeItem(VERIFIED_BUSINESSES_KEY);
    } catch (error) {
      console.error('Error clearing verified businesses:', error);
    }
  };

  const setBusinessPassword = async (businessId: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      console.log('Setting password for business:', businessId);
      
      const { data, error } = await supabase.functions.invoke('hash-business-password', {
        body: { businessId, password }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Error setting business password:', error);
        toast({
          title: "Failed to Set Password",
          description: error.message || "Please try again later.",
          variant: "destructive",
        });
        return false;
      }

      // Check if the response indicates success
      if (data?.success === true) {
        toast({
          title: "Password Set Successfully",
          description: "Your business is now password protected.",
        });
        return true;
      } else {
        console.error('Password setting failed:', data);
        const errorMessage = data?.error || data?.details || "Please try again later.";
        toast({
          title: "Failed to Set Password",
          description: errorMessage,
          variant: "destructive",
        });
        return false;
      }
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
      
      const { data, error } = await supabase.functions.invoke('verify-business-password', {
        body: { businessId, password }
      });

      console.log('Verification response:', { data, error });

      if (error) {
        console.error('Error verifying business password:', error);
        toast({
          title: "Verification Failed",
          description: "Could not verify password. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      const isVerified = data?.verified === true;
      
      if (isVerified) {
        setBusinessVerified(businessId);
        console.log('Password verified successfully for business:', businessId);
      } else {
        console.log('Password verification failed for business:', businessId);
        toast({
          title: "Incorrect Password",
          description: "The password you entered is incorrect.",
          variant: "destructive",
        });
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
      const { error } = await supabase
        .from('business_locations')
        .update({ switch_password_hash: null })
        .eq('id', businessId);

      if (error) {
        console.error('Error removing business password:', error);
        toast({
          title: "Failed to Remove Password",
          description: error.message || "Please try again later.",
          variant: "destructive",
        });
        return false;
      }

      // Remove from verified list since password is removed
      const verified = getVerifiedBusinesses();
      verified.delete(businessId);
      sessionStorage.setItem(VERIFIED_BUSINESSES_KEY, JSON.stringify(Array.from(verified)));

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