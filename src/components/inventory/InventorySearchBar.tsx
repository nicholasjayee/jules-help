import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Product } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';

interface InventorySearchBarProps {
    filters: any;
    setFilters: (filters: any) => void;
    products: Product[];
    onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSearchFocus?: () => void;
}

const InventorySearchBar: React.FC<InventorySearchBarProps> = ({
    filters,
    setFilters,
    products,
    onSearchChange,
    onSearchFocus
}) => {
    const isMobile = useIsMobile();
    // Local state for manual search
    const [localSearch, setLocalSearch] = useState(filters.search || '');

    // Synchronize local state if parent filter changes externally
    useEffect(() => {
        setLocalSearch(filters.search || '');
    }, [filters.search]);

    // Handle typing - update local state only
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalSearch(e.target.value);
        // Note: We do NOT call setFilters or onSearchChange here
        // to prevent auto-submit / auto-filter
    };

    // Submit on Enter key
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Apply the filter
            setFilters({
                ...filters,
                search: localSearch
            });
            // Also manually trigger the onSearchChange prop if needed by parent logic (rarely used if we use setFilters directly)
            // keeping it simple: just update filters
        }
    };

    // Submit on Blur
    const handleBlur = () => {
        if (localSearch !== filters.search) {
            setFilters({
                ...filters,
                search: localSearch
            });
        }
    };

    return (
        <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
                placeholder="Search products (Press Enter)..."
                value={localSearch}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onFocus={onSearchFocus}
                className="pl-9 w-full bg-white transition-all duration-200 focus:shadow-md"
            />
        </div>
    );
};

export default InventorySearchBar;
