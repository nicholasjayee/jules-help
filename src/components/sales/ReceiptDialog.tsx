import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sale } from '@/types';

const ReceiptDialog = ({ isOpen, onOpenChange, sale, currency }: { isOpen: boolean, onOpenChange: (open: boolean) => void, sale: Sale | null, currency: string }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <div>Receipt Dialog for Sale {sale?.receiptNumber} ({currency})</div>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptDialog;
