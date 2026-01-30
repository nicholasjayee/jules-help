
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/hooks/use-toast';
import { useBusiness } from '@/components/contexts/BusinessContext';
import { useActivityLogger } from '@/components/hooks/useActivityLogger';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dataStore } from '@/lib/dataStore';
import { Customer } from '@/components/types/index';
import { useAuth } from '@/components/auth/AuthProvider';

export const useCustomers = (initialPageSize: number = 50) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();
  const { currentBusiness } = useBusiness();
  const { user } = useAuth();
  const { logActivity } = useActivityLogger();
  const queryClient = useQueryClient();

  const loadCustomers = useCallback(async (): Promise<{ customers: Customer[], count: number }> => {
    if (!currentBusiness || !user) {
      return { customers: [], count: 0 };
    }

    try {
      const allCustomers = await dataStore.getCustomers(user.id);
      return { customers: allCustomers, count: allCustomers.length };
    } catch (error) {
      console.error('Error loading customers:', error);
      toast({
        title: "Error",
        description: "Failed to load customers. Please try again.",
        variant: "destructive"
      });
      return { customers: [], count: 0 };
    }
  }, [currentBusiness?.id, user, toast]);

  const queryKey = ['customers', currentBusiness?.id];
  const { data: queriedData, isLoading: isQueryLoading } = useQuery({
    queryKey,
    queryFn: loadCustomers,
    enabled: !!currentBusiness?.id && !!user,
  });

  useEffect(() => {
    if (queriedData) {
      setCustomers(queriedData.customers);
      setTotalCount(queriedData.count);
    }
  }, [queriedData]);

  const isLoading = isQueryLoading && !queriedData;

  const createCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!currentBusiness || !user) {
      toast({
        title: "Error",
        description: "No business selected",
        variant: "destructive"
      });
      return null;
    }

    try {
      const newCustomer: Customer = {
        id: `cust-${Date.now()}`,
        fullName: customerData.fullName,
        phoneNumber: customerData.phoneNumber || null,
        email: customerData.email || null,
        birthday: customerData.birthday || null,
        gender: customerData.gender || null,
        location: customerData.location || null,
        categoryId: customerData.categoryId || null,
        notes: customerData.notes || null,
        tags: customerData.tags || null,
        socialMedia: customerData.socialMedia || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await dataStore.createCustomer(newCustomer);

      setCustomers(prev => [newCustomer, ...prev]);
      setTotalCount(c => c + 1);
      queryClient.invalidateQueries({ queryKey });

      logActivity({
        activityType: 'CREATE',
        module: 'CUSTOMERS',
        entityType: 'customer',
        entityId: newCustomer.id,
        entityName: newCustomer.fullName,
        description: `Created customer "${newCustomer.fullName}"`
      });

      toast({
        title: "Success",
        description: "Customer created successfully"
      });

      return newCustomer;
    } catch (error) {
      console.error('Error creating customer:', error);
      toast({
        title: "Error",
        description: "Failed to create customer.",
        variant: "destructive"
      });
      return null;
    }
  };

  const addCustomer = createCustomer;

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    try {
      await dataStore.updateCustomer(id, updates);
      
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      queryClient.invalidateQueries({ queryKey });

      toast({
        title: "Success",
        description: "Customer updated successfully"
      });

      return true;
    } catch (error) {
      console.error('Error updating customer:', error);
      return false;
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      await dataStore.deleteCustomer(id);
      
      setCustomers(prev => prev.filter(c => c.id !== id));
      setTotalCount(c => Math.max(0, c - 1));
      queryClient.invalidateQueries({ queryKey });

      toast({
        title: "Success",
        description: "Customer deleted successfully"
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting customer:', error);
      return false;
    }
  };

  return {
    customers,
    isLoading,
    createCustomer,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    loadCustomers,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount
  };
};
