
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBusiness } from '@/contexts/BusinessContext';
import { useActivityLogger } from '@/hooks/useActivityLogger';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface Customer {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  email: string | null;
  birthday: Date | null;
  gender: string | null;
  location: string | null;
  categoryId: string | null; // Added category field
  notes: string | null;
  tags: string[] | null;
  socialMedia: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    linkedin?: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export const useCustomers = (initialPageSize: number = 50) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();
  const { currentBusiness } = useBusiness();
  const { logActivity } = useActivityLogger();
  const queryClient = useQueryClient();

  const loadCustomers = useCallback(async (): Promise<{ customers: Customer[], count: number }> => {
    if (!currentBusiness) {
      return { customers: [], count: 0 };
    }

    try {
      // Get total count first
      const { count: totalCountResult } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', currentBusiness.id);

      // Load all customers with chunked pagination (no page limit)
      let allCustomers: any[] = [];
      let start = 0;
      const chunkSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: chunk, error: chunkError } = await supabase
          .from('customers')
          .select('*')
          .eq('location_id', currentBusiness.id)
          .order('full_name')
          .range(start, start + chunkSize - 1);

        if (chunkError) throw chunkError;

        if (chunk && chunk.length > 0) {
          allCustomers.push(...chunk);
          start += chunkSize;
          hasMore = chunk.length === chunkSize;
        } else {
          hasMore = false;
        }
      }

      const formattedCustomers: Customer[] = allCustomers.map(customer => ({
        id: customer.id,
        fullName: customer.full_name,
        phoneNumber: customer.phone_number,
        email: customer.email,
        birthday: customer.birthday ? new Date(customer.birthday) : null,
        gender: customer.gender,
        location: customer.location,
        categoryId: customer.category_id,
        notes: customer.notes,
        tags: customer.tags,
        socialMedia: customer.social_media as {
          instagram?: string;
          facebook?: string;
          twitter?: string;
          linkedin?: string;
        } || null,
        createdAt: new Date(customer.created_at),
        updatedAt: new Date(customer.updated_at)
      }));

      return { customers: formattedCustomers, count: totalCountResult || 0 };
    } catch (error) {
      console.error('Error loading customers:', error);
      toast({
        title: "Error",
        description: "Failed to load customers. Please try again.",
        variant: "destructive"
      });
      return { customers: [], count: 0 };
    }
  }, [currentBusiness?.id, toast]);

  // React Query caching
  const queryKey = ['customers', currentBusiness?.id];
  const { data: queriedData, isLoading: isQueryLoading, isFetching } = useQuery({
    queryKey,
    queryFn: loadCustomers,
    enabled: !!currentBusiness?.id,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (queriedData) {
      setCustomers(queriedData.customers);
      setTotalCount(queriedData.count);
    }
  }, [queriedData]);

  // Derived loading state to avoid flash on background refetch
  const isLoading = isQueryLoading && !queriedData;

  const createCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!currentBusiness) {
      toast({
        title: "Error",
        description: "No business selected",
        variant: "destructive"
      });
      return null;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const insertData = {
        user_id: userData.user.id,
        location_id: currentBusiness.id,
        full_name: customerData.fullName,
        phone_number: customerData.phoneNumber || null,
        email: customerData.email || null,
        birthday: customerData.birthday?.toISOString().split('T')[0] || null,
        gender: customerData.gender || null,
        location: customerData.location || null,
        category_id: customerData.categoryId || null, // Added category field
        notes: customerData.notes || null,
        tags: customerData.tags || null,
        social_media: customerData.socialMedia || null
      };

      const { data, error } = await supabase
        .from('customers')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Format the new customer and update cache immediately
      const newCustomer: Customer = {
        id: data.id,
        fullName: data.full_name,
        phoneNumber: data.phone_number,
        email: data.email,
        birthday: data.birthday ? new Date(data.birthday) : null,
        gender: data.gender,
        location: data.location,
        categoryId: data.category_id,
        notes: data.notes,
        tags: data.tags,
        socialMedia: data.social_media,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      // Update local state immediately
      setCustomers(prev => [newCustomer, ...prev]);
      setTotalCount(c => c + 1);

      // Update React Query cache immediately
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return { customers: [newCustomer], count: 1 };
        return { 
          customers: [newCustomer, ...oldData.customers], 
          count: (oldData.count || 0) + 1 
        };
      });
      
      // Log activity
      await logActivity({
        activityType: 'CREATE',
        module: 'CUSTOMERS',
        entityType: 'customer',
        entityId: data.id,
        entityName: customerData.fullName,
        description: `Created customer "${customerData.fullName}"`,
        metadata: {
          phoneNumber: customerData.phoneNumber,
          email: customerData.email,
          location: customerData.location
        }
      });
      
      toast({
        title: "Success",
        description: "Customer created successfully"
      });

      return data;
    } catch (error) {
      console.error('Error creating customer:', error);
      toast({
        title: "Error",
        description: "Failed to create customer. Please try again.",
        variant: "destructive"
      });
      return null;
    }
  };

  const addCustomer = createCustomer;

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    try {
      const updateData: any = {};
      
      if (updates.fullName !== undefined) updateData.full_name = updates.fullName;
      if (updates.phoneNumber !== undefined) updateData.phone_number = updates.phoneNumber;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.birthday !== undefined) updateData.birthday = updates.birthday?.toISOString().split('T')[0];
      if (updates.gender !== undefined) updateData.gender = updates.gender;
      if (updates.location !== undefined) updateData.location = updates.location;
      if (updates.categoryId !== undefined) updateData.category_id = updates.categoryId; // Added category update
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.tags !== undefined) updateData.tags = updates.tags;
      if (updates.socialMedia !== undefined) updateData.social_media = updates.socialMedia;

      const { error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Update local state immediately
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

      // Update React Query cache immediately
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          customers: oldData.customers.map((c: Customer) => 
            c.id === id ? { ...c, ...updates } : c
          )
        };
      });
      
      // Log activity
      const customer = customers.find(c => c.id === id);
      if (customer) {
        await logActivity({
          activityType: 'UPDATE',
          module: 'CUSTOMERS',
          entityType: 'customer',
          entityId: id,
          entityName: customer.fullName,
          description: `Updated customer "${customer.fullName}"`,
          metadata: { updates }
        });
      }
      
      toast({
        title: "Success",
        description: "Customer updated successfully"
      });

      return true;
    } catch (error) {
      console.error('Error updating customer:', error);
      toast({
        title: "Error",
        description: "Failed to update customer. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      // Get customer details before deletion
      const customer = customers.find(c => c.id === id);
      
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      // Optimistic update: remove locally
      setCustomers(prev => prev.filter(c => c.id !== id));
      setTotalCount(c => Math.max(0, c - 1));
      // Update cache immediately for current page
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        const { customers: oldCustomers, count } = old;
        const newCustomers = (oldCustomers as Customer[]).filter(c => c.id !== id);
        return { customers: newCustomers, count: Math.max(0, (count || 0) - 1) };
      });
      queryClient.invalidateQueries({ queryKey });
      
      // Log activity
      if (customer) {
        await logActivity({
          activityType: 'DELETE',
          module: 'CUSTOMERS',
          entityType: 'customer',
          entityId: id,
          entityName: customer.fullName,
          description: `Deleted customer "${customer.fullName}"`,
          metadata: {
            phoneNumber: customer.phoneNumber,
            email: customer.email
          }
        });
      }
      
      toast({
        title: "Success",
        description: "Customer deleted successfully"
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: "Error",
        description: "Failed to delete customer. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  // Initial load handled by React Query; no manual trigger needed

  // Realtime: invalidate customer list when changes occur for this location
  useEffect(() => {
    if (!currentBusiness?.id) return;

    const channel = supabase
      .channel('customers_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'customers',
        filter: `location_id=eq.${currentBusiness.id}`
      }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentBusiness?.id, page, pageSize]);

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
