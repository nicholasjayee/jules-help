
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/hooks/use-toast';
import { useBusiness } from '@/components/contexts/BusinessContext';
import { dataStore } from '@/lib/dataStore';
import { BusinessSettings } from '@/components/types/index';

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

export const convertPaymentMethodsToString = (paymentMethods: { method: string, accountNumber: string, accountName: string }[]): string => {
  return paymentMethods
    .filter(pm => pm.method.trim() !== '' || pm.accountNumber.trim() !== '' || pm.accountName.trim() !== '')
    .map(pm => `${pm.method}\n${pm.accountNumber}\n${pm.accountName}`)
    .join('\n');
};

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
      const data = await dataStore.getBusinessSettings(currentBusiness.id);
      return data || getDefaultSettings();
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
      await dataStore.updateBusinessSettings(currentBusiness.id, newSettings);

      toast({
        title: "Success",
        description: "Business settings updated successfully"
      });

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

  const { data: queriedData, isLoading: isQueryLoading, isFetching, refetch } = useQuery({
    queryKey: ['businessSettings', currentBusiness?.id],
    queryFn: loadSettings,
    enabled: !!currentBusiness?.id,
  });

  useEffect(() => {
    if (queriedData) {
      setSettings(queriedData);
    } else if (!currentBusiness) {
      setSettings(getDefaultSettings());
    }
  }, [queriedData, currentBusiness]);

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

// Re-export interface if needed, though it's in types/index.ts
export type { BusinessSettings } from '@/components/types/index';
