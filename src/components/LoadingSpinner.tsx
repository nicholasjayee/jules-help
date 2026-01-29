import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ className }: { className?: string }) => {
  return (
    <div className={`flex justify-center items-center ${className}`}>
      <Loader2 className="animate-spin h-6 w-6 text-primary" />
    </div>
  );
};

export default LoadingSpinner;
