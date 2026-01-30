
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBusiness } from '@/contexts/BusinessContext';

export interface BusinessSettings {
  id?: string;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  businessLogo?: string;
  currency: string;
  signature?: string;
  paymentInfo?: string;
  defaultPrintFormat?: 'standard' | 'thermal';
}

// Utility function to parse payment info text into structured format
export const parsePaymentInfo = (paymentInfo: string): { method: string, accountNumber: string, accountName: string }[] => {
  if (!paymentInfo || paymentInfo.trim() === '') {
    return [];
  }

  const lines = paymentInfo.split('\n').filter(line => line.trim() !== '');
  const methods: { method: string, accountNumber: string, accountName: string }[] = [];

  for (let i = 0; i < lines.length; i += 3) {
    if (i + 2 < lines.length) {
      methods.push({
        method: lines[i].trim(),
        accountNumber: lines[i + 1].trim(),
        accountName: lines[i + 2].trim()
      });
    }
  }

  return methods;
};

// Utility function to convert payment methods array back to string format
export const convertPaymentMethodsToString = (paymentMethods: { method: string, accountNumber: string, accountName: string }[]): string => {
  return paymentMethods
    .filter(pm => pm.method.trim() !== '' || pm.accountNumber.trim() !== '' || pm.accountName.trim() !== '')
    .map(pm => `${pm.method}\n${pm.accountNumber}\n${pm.accountName}`)
    .join('\n');
};

// Default settings for new businesses
const getDefaultSettings = (): BusinessSettings => ({
  businessName: 'Your Business Name',
  businessAddress: 'Your Business Address',
  businessPhone: '(123) 456-7890',
  businessEmail: 'support@yourbusiness.com',
  currency: 'UGX',
  paymentInfo: '',
  defaultPrintFormat: 'standard'
});

export const useBusinessSettings = () => {
  const [settings, setSettings] = useState<BusinessSettings>(getDefaultSettings());
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { currentBusiness } = useBusiness();

  const loadSettings = async (): Promise<BusinessSettings> => {
    if (!currentBusiness) {
      return getDefaultSettings();
    }

    try {
      const { data, error } = await (supabase
        .from('business_settings' as any)
        .select('*')
        .eq('location_id', currentBusiness.id)
        .maybeSingle()) as { data: any, error: any };
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading business settings:', error);
        throw error;
      }

      if (data) {
        // Extract payment info from metadata
        const paymentInfo = data.metadata && typeof data.metadata === 'object' ?
          (data.metadata as Record<string, unknown>).payment_info as string || '' : '';

        return {
          id: data.id,
          businessName: data.business_name,
          businessAddress: data.business_address,
          businessPhone: data.business_phone,
          businessEmail: data.business_email,
          businessLogo: data.business_logo,
          currency: data.currency,
          signature: data.signature,
          paymentInfo: paymentInfo,
          defaultPrintFormat: data.metadata && typeof data.metadata === 'object' ?
            (data.metadata as Record<string, unknown>).default_print_format as 'standard' | 'thermal' || 'standard' : 'standard'
        };
      } else {
        return getDefaultSettings();
      }
    } catch (error) {
      console.error('Error loading business settings:', error);
      toast({
        title: "Error",
        description: "Failed to load business settings. Please try again.",
        variant: "destructive"
      });
      return getDefaultSettings();
    }
  };

  const updateSettings = async (newSettings: Partial<BusinessSettings>) => {
    if (!currentBusiness) {
      console.error('No business selected for updating settings');
      toast({
        title: "Error",
        description: "No business selected",
        variant: "destructive"
      });
      return false;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        console.error('User not authenticated');
        throw new Error('User not authenticated');
      }

      // Prepare the metadata object with payment info
      const metadata = {
        payment_info: newSettings.hasOwnProperty('paymentInfo') ? newSettings.paymentInfo : settings.paymentInfo || '',
        default_print_format: newSettings.hasOwnProperty('defaultPrintFormat') ? newSettings.defaultPrintFormat : settings.defaultPrintFormat || 'standard'
      };

      const updateData = {
        user_id: userData.user.id,
        location_id: currentBusiness.id,
        business_name: newSettings.hasOwnProperty('businessName') ? newSettings.businessName : settings.businessName,
        business_address: newSettings.hasOwnProperty('businessAddress') ? newSettings.businessAddress : settings.businessAddress,
        business_phone: newSettings.hasOwnProperty('businessPhone') ? newSettings.businessPhone : settings.businessPhone,
        business_email: newSettings.hasOwnProperty('businessEmail') ? newSettings.businessEmail : settings.businessEmail,
        business_logo: newSettings.hasOwnProperty('businessLogo') ? newSettings.businessLogo : settings.businessLogo,
        currency: newSettings.hasOwnProperty('currency') ? newSettings.currency : settings.currency,
        signature: newSettings.hasOwnProperty('signature') ? newSettings.signature : settings.signature,
        metadata: metadata
      };

      const { data, error } = await (supabase
        .from('business_settings' as any)
        .upsert(updateData, {
          onConflict: 'location_id'
        })
        .select()
        .single()) as { data: any, error: any };

      if (error) {
        console.error('Supabase error updating business settings:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Business settings updated successfully"
      });

      // Refetch settings after update
      refetch();

      return true;
    } catch (error) {
      console.error('Error updating business settings:', error);
      toast({
        title: "Error",
        description: "Failed to update business settings. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  // React Query for settings loading with proper caching
  const { data: queriedData, isLoading: isQueryLoading, isFetching, refetch } = useQuery({
    queryKey: ['businessSettings', currentBusiness?.id],
    queryFn: loadSettings,
    enabled: !!currentBusiness?.id,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Sync React Query data with local state
  useEffect(() => {
    if (queriedData) {
      setSettings(queriedData);
    } else if (!currentBusiness) {
      setSettings(getDefaultSettings());
    }
  }, [queriedData, currentBusiness]);

  // Sync loading state from React Query
  useEffect(() => {
    setIsLoading(isQueryLoading || isFetching);
  }, [isQueryLoading, isFetching]);

  return {
    settings,
    isLoading,
    updateSettings,
    loadSettings
  };
};
