import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sale } from '@/types';

export const useSalesActions = () => {
  const navigate = useNavigate();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [isDeletingSale, setIsDeletingSale] = useState(false);

  const handleEditSale = useCallback((sale: Sale) => {
    navigate('/new-sale', { state: { editSale: sale } });
  }, [navigate]);

  const handleViewReceipt = useCallback((sale: Sale) => {
    setSelectedSale(sale);
    setIsReceiptDialogOpen(true);
  }, []);

  const handleDeleteSale = useCallback((deleteSale: (id: string) => Promise<boolean>) => {
    return async (sale: Sale) => {
      setIsDeletingSale(true);
      try {
        await deleteSale(sale.id);
      } finally {
        setIsDeletingSale(false);
      }
    };
  }, []);

  const handleCloseReceiptDialog = useCallback((open: boolean) => {
    setIsReceiptDialogOpen(open);
    if (!open) setSelectedSale(null);
  }, []);

  return {
    selectedSale,
    isReceiptDialogOpen,
    isDeletingSale,
    handleEditSale,
    handleViewReceipt,
    handleDeleteSale,
    handleCloseReceiptDialog
  };
};