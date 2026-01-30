
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Receipt, DollarSign, Package, Users, Wallet } from 'lucide-react';

const MobileNavigation = () => {
  const location = useLocation();
  
  
  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  // Static mobile navigation items - removed Tasks
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50 md:hidden safe-area-inset-bottom">
      <div className="flex justify-between items-center px-1 py-2 min-h-[60px]">
        <Link
          to="/"
          className={`flex flex-1 flex-col items-center py-2 px-1 rounded-md transition-colors min-h-[48px] ${
            isActive('/') ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
          }`}
        >
          <Home className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium text-center">Dashboard</span>
        </Link>
        
        <Link
          to="/sales"
          className={`flex flex-1 flex-col items-center py-2 px-1 rounded-md transition-colors min-h-[48px] ${
            isActive('/sales') ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
          }`}
        >
          <Receipt className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium text-center">Sales</span>
        </Link>
        
        <Link
          to="/inventory"
          className={`flex flex-1 flex-col items-center py-2 px-1 rounded-md transition-colors min-h-[48px] ${
            isActive('/inventory') ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
          }`}
        >
          <Package className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium text-center">Inventory</span>
        </Link>
        
        <Link
          to="/cash"
          className={`flex flex-1 flex-col items-center py-2 px-1 rounded-md transition-colors min-h-[48px] ${
            isActive('/cash') ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
          }`}
        >
          <Wallet className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium text-center">Finance</span>
        </Link>
        
        <Link
          to="/expenses"
          className={`flex flex-1 flex-col items-center py-2 px-1 rounded-md transition-colors min-h-[48px] ${
            isActive('/expenses') ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
          }`}
        >
          <DollarSign className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium text-center">Expenses</span>
        </Link>
        
        <Link
          to="/customers"
          className={`flex flex-1 flex-col items-center py-2 px-1 rounded-md transition-colors min-h-[48px] ${
            isActive('/customers') ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
          }`}
        >
          <Users className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium text-center">Customers</span>
        </Link>

      </div>
    </div>
  );
};

export default MobileNavigation;
