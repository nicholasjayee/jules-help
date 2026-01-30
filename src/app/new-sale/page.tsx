
'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SalesForm from '@/components/SalesForm';
import { dataStore } from '@/lib/dataStore';
import { Sale } from '@/components/types/index';
import { useAuth } from '@/components/auth/AuthProvider';
import { useBusiness } from '@/components/contexts/BusinessContext';

export default function NewSalePage() {
  const searchParams = useSearchParams();
  const saleId = searchParams.get('id');
  const [initialData, setInitialData] = useState<Sale | undefined>(undefined);
  const [loading, setLoading] = useState(!!saleId);
  const { user } = useAuth();
  const { currentBusiness } = useBusiness();

  useEffect(() => {
    const fetchSale = async () => {
      if (saleId && user && currentBusiness) {
        try {
          const sales = await dataStore.getSales(user.id, currentBusiness.id);
          const sale = sales.find(s => s.id === saleId);
          if (sale) {
            setInitialData(sale);
          }
        } catch (error) {
          console.error("Failed to fetch sale for editing", error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchSale();
  }, [saleId, user, currentBusiness]);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return <SalesForm initialData={initialData} />;
}
