import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export const useDashboardActions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Optimized refresh handler with mobile considerations
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    
    toast({
      title: "Updating app",
      description: "Getting the latest updates and refreshing data...",
    });
    
    try {
      // Clear caches more efficiently for mobile
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Force complete reload from server
      setTimeout(() => {
        window.location.reload();
      }, 800); // Shorter delay for mobile
      
    } catch (error) {
      console.error('Error during app update:', error);
      setIsRefreshing(false);
      toast({
        title: "Update failed",
        description: "There was an error updating the app. Please try again.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const handleQuickCreate = useCallback((paymentStatus: 'Paid' | 'NOT PAID' | 'Quote' | 'Installment Sale') => {
    navigate('/new-sale', { state: { defaultPaymentStatus: paymentStatus } });
  }, [navigate]);

  return {
    isRefreshing,
    handleRefresh,
    handleQuickCreate
  };
};