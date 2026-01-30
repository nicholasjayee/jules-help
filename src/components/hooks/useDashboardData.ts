import { useMemo, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useBusiness } from '@/contexts/BusinessContext';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useSalesData } from '@/hooks/useSalesData';
import { useAppUpdate } from '@/hooks/useAppUpdate';

export const useDashboardData = () => {
  const { user } = useAuth();
  const { isLoading: businessLoading, error: businessError, currentBusiness } = useBusiness();
  const { settings, isLoading: settingsLoading } = useBusinessSettings();
  // Load all sales for accurate analytics calculations
  // The AnalyticsDashboard component is already lazy-loaded, so this won't block initial render
  const { sales, isLoading: salesLoading } = useSalesData(user?.id, 'desc');
  const { updateAvailable, isUpdating, triggerUpdate } = useAppUpdate();

  // Memoize page title computation with more efficient logic
  const pageTitle = useMemo(() => {
    if (!settings.businessName || settings.businessName === 'Your Business Name') {
      return 'Dashboard';
    }
    return settings.businessName;
  }, [settings.businessName]);

  // Memoize non-quote sales count with early return optimization
  const nonQuoteSalesCount = useMemo(() => {
    if (!sales.length) return 0;
    return sales.filter(sale => sale.paymentStatus !== 'Quote').length;
  }, [sales]);

  // Optimize loading state calculation
  const isLoading = useMemo(() => {
    return salesLoading || settingsLoading || businessLoading;
  }, [salesLoading, settingsLoading, businessLoading]);

  return {
    user,
    businessError,
    currentBusiness,
    settings,
    sales,
    pageTitle,
    nonQuoteSalesCount,
    isLoading,
    updateAvailable,
    isUpdating,
    triggerUpdate
  };
};