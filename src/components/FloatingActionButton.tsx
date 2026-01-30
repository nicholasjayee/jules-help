
import React, { useState } from 'react';
import { Plus, Package, ShoppingCart, Users, DollarSign, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';

const FloatingActionButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleNavigation = (path: string, state?: any) => {
    navigate(path, { state });
    setIsOpen(false);
  };

  return (
    <div className={`fixed ${isMobile ? 'bottom-28' : 'bottom-6'} right-6 z-50`}>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => handleNavigation('/new-sale')}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Create Sale
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNavigation('/new-sale', { defaultPaymentStatus: 'Installment Sale' })}>
            <CreditCard className="mr-2 h-4 w-4" />
            Create Installment Sale
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNavigation('/inventory/new')}>
            <Package className="mr-2 h-4 w-4" />
            Add Product
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNavigation('/customers')}>
            <Users className="mr-2 h-4 w-4" />
            Add Customer
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNavigation('/expenses')}>
            <DollarSign className="mr-2 h-4 w-4" />
            Add Expense
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default FloatingActionButton;
