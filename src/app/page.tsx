import React, { useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useBusiness } from "@/contexts/BusinessContext";
import { useProducts } from "@/hooks/useProducts";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import InventoryStats from "@/components/inventory/InventoryStats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductSuggestionsPanel from "@/components/inventory/ProductSuggestionsPanel";
import { useProductSuggestions } from "@/hooks/useProductSuggestions";
import { Product } from "@/types";
import SoldItemsTab from "@/components/inventory/SoldItemsTab";
import StockSummaryTab from "@/components/inventory/StockSummaryTab";
import CSVUploadDialog from "@/components/inventory/CSVUploadDialog";
import { useBulkProducts } from "@/hooks/useBulkProducts";
import { generateProductCSVTemplate } from "@/utils/csvTemplate";
import { useCategories } from "@/hooks/useCategories";
import BulkStockAddTab from "@/components/inventory/BulkStockAddTab";
import RequisitionTab from "@/components/inventory/RequisitionTab";
import { useSalesData } from "@/hooks/useSalesData";
import InventoryPageSkeleton from "@/components/inventory/InventoryPageSkeleton";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import InventorySearchBar from "@/components/inventory/InventorySearchBar";
import TopSellingProductsCard from "@/components/inventory/TopSellingProductsCard";
import StockLevelOverviewCard from "@/components/inventory/StockLevelOverviewCard";
import { useInventoryData } from "@/hooks/useInventoryData";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalInventoryStats } from "@/hooks/useGlobalInventoryStats";
import { useQueryClient } from "@tanstack/react-query";

const Inventory = () => {
  const { user } = useAuth();
  const { currentBusiness, isLoading: businessLoading } = useBusiness();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const {
    products,
    isLoading,
    loadProducts,
    filters,
    setFilters,
    filteredProducts,
    totalCount,
    refetch,
  } = useProducts(user?.id);

  const { categories } = useCategories(user?.id);
  const { bulkCreateProducts } = useBulkProducts();
  const { sales } = useSalesData(user?.id);

  // Add state for CSV upload dialog
  const [csvUploadOpen, setCsvUploadOpen] = React.useState(false);

  // Add state for period filtering
  const [period, setPeriod] = React.useState<
    | "today"
    | "yesterday"
    | "this-week"
    | "last-week"
    | "this-month"
    | "last-month"
    | "all-time"
  >("this-month");

  // Global stats hook
  const { data: globalStats, refetch: refetchGlobalStats } =
    useGlobalInventoryStats(currentBusiness?.id);
  const queryClient = useQueryClient();

  // Real-time synchronization for global stats
  React.useEffect(() => {
    if (!user?.id || !currentBusiness?.id) return;

    console.log("[Realtime] Subscribing to product changes for stats update");
    const channel = supabase
      .channel("inventory_stats_sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `location_id=eq.${currentBusiness.id}`,
        },
        () => {
          console.log(
            "[Realtime] Product change detected, refreshing stats...",
          );
          queryClient.invalidateQueries({
            queryKey: ["inventory_global_stats", currentBusiness.id],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, currentBusiness?.id]);

  // Use inventory data hook
  const { topSellingProducts } = useInventoryData(
    filteredProducts,
    sales,
    period,
  );

  // Product suggestions hook - only for overview tab
  const {
    suggestions,
    isOpen: panelOpen,
    openPanel,
    closePanel,
  } = useProductSuggestions(products, filters.search);

  // Memoize handlers to prevent unnecessary re-renders
  const handleRefresh = useCallback(async () => {
    // Clear the specific new cache keys if we want to force EVERYTHING (optional with React Query but good for "Refresh" button)
    queryClient.invalidateQueries({ queryKey: ["inventory_global_stats"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });

    // Force immediate reload of global stats
    await refetchGlobalStats();

    // Reload products from server
    await refetch();

    toast({
      title: "Inventory refreshed",
      description:
        "Your inventory data and stats have been updated with fresh server data.",
    });
  }, [refetch, toast, refetchGlobalStats, queryClient]);

  // Memoize search input changes handler
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters({
        ...filters,
        search: e.target.value,
      });
    },
    [filters, setFilters],
  );

  // Handle product selection from suggestions
  const handleProductSelect = (product: Product) => {
    setFilters({
      ...filters,
      search: product.name,
    });
    closePanel();
  };

  // Handle input focus for desktop search
  const handleSearchFocus = useCallback(() => {
    if (filters.search) {
      openPanel();
    }
  }, [filters.search, openPanel]);

  // Add CSV template download handler
  const handleDownloadTemplate = React.useCallback(() => {
    generateProductCSVTemplate();
    toast({
      title: "Template downloaded",
      description: "CSV template has been downloaded to your device.",
    });
  }, [toast]);

  // Add CSV upload handler
  const handleCSVUpload = React.useCallback(
    async (products: any[]) => {
      try {
        await bulkCreateProducts(products);
        setCsvUploadOpen(false);
        await loadProducts();
      } catch (error) {
        console.error("CSV upload failed:", error);
        toast({
          title: "Upload failed",
          description:
            "There was an error uploading your products. Please try again.",
          variant: "destructive",
        });
      }
    },
    [bulkCreateProducts, loadProducts, toast],
  );

  if (businessLoading || !currentBusiness || isLoading) {
    return <InventoryPageSkeleton />;
  }

  return (
    <div className="p-2 md:p-6 space-y-4 md:space-y-6 max-w-full">
      {/* Header Section */}
      <InventoryHeader
        isLoading={isLoading}
        onRefresh={handleRefresh}
        onDownloadTemplate={handleDownloadTemplate}
        onCSVUpload={() => setCsvUploadOpen(true)}
      />

      {/* CSV Upload Dialog */}
      <CSVUploadDialog
        open={csvUploadOpen}
        onOpenChange={setCsvUploadOpen}
        onUpload={handleCSVUpload}
        categories={categories.map((cat) => cat.name)}
      />

      {/* Stats Cards */}
      <InventoryStats
        products={products}
        totalCountOverride={totalCount}
        totalCostValueOverride={globalStats?.totalCostValue}
        lowStockOverride={globalStats?.lowStockCount}
        outOfStockOverride={globalStats?.outOfStockCount}
        totalStockValueOverride={globalStats?.totalStockValue}
      />

      {/* Main Content with Tabs */}
      <Tabs defaultValue="overview" className="space-y-3 md:space-y-6">
        <TabsList
          className={`grid w-full ${isMobile ? "grid-cols-3 gap-1" : "grid-cols-5"} h-auto p-1`}
        >
          <TabsTrigger
            value="overview"
            className="text-xs md:text-sm px-1 md:px-2 py-2 min-h-[44px]"
          >
            {isMobile ? "Overview" : "Overview"}
          </TabsTrigger>
          <TabsTrigger
            value="add-stock"
            className="text-xs md:text-sm px-1 md:px-2 py-2 min-h-[44px]"
          >
            {isMobile ? "Restock" : "Restock"}
          </TabsTrigger>
          <TabsTrigger
            value="requisition"
            className="text-xs md:text-sm px-1 md:px-2 py-2 min-h-[44px]"
          >
            {isMobile ? "Request" : "Requisition"}
          </TabsTrigger>
          {!isMobile && (
            <>
              <TabsTrigger
                value="sold-items"
                className="text-xs md:text-sm px-1 md:px-2 py-2 min-h-[44px]"
              >
                Items Sold
              </TabsTrigger>
              <TabsTrigger
                value="stock-summary"
                className="text-xs md:text-sm px-1 md:px-2 py-2 min-h-[44px]"
              >
                Stock Summary
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Mobile: Additional tabs in dropdown or secondary row */}
        {isMobile && (
          <div className="flex gap-1 overflow-x-auto pb-2">
            <TabsList className="grid grid-cols-2 gap-1 w-auto min-w-fit p-1">
              <TabsTrigger
                value="sold-items"
                className="text-xs px-2 py-2 min-h-[44px] whitespace-nowrap"
              >
                Items Sold
              </TabsTrigger>
              <TabsTrigger
                value="stock-summary"
                className="text-xs px-2 py-2 min-h-[44px] whitespace-nowrap"
              >
                Stock Summary
              </TabsTrigger>
            </TabsList>
          </div>
        )}

        <TabsContent value="overview" className="space-y-4 md:space-y-6">
          {/* Search Bar */}
          <InventorySearchBar
            filters={filters}
            setFilters={setFilters}
            products={products}
            onSearchChange={handleSearchChange}
            onSearchFocus={handleSearchFocus}
          />

          {/* Stock Level Overview Chart */}
          <StockLevelOverviewCard products={products} />

          {/* Top Selling Products */}
          <TopSellingProductsCard
            topSellingProducts={topSellingProducts}
            period={period}
            onPeriodChange={setPeriod}
          />
        </TabsContent>

        <TabsContent value="add-stock">
          <BulkStockAddTab />
        </TabsContent>

        <TabsContent value="requisition">
          <RequisitionTab />
        </TabsContent>

        <TabsContent value="sold-items">
          <SoldItemsTab />
        </TabsContent>

        <TabsContent value="stock-summary">
          <StockSummaryTab />
        </TabsContent>
      </Tabs>

      {/* Product Suggestions Panel for Desktop Search */}
      {!isMobile && (
        <ProductSuggestionsPanel
          suggestions={suggestions}
          isOpen={panelOpen}
          onClose={closePanel}
          onSelectProduct={handleProductSelect}
          searchTerm={filters.search}
        />
      )}
    </div>
  );
};

export default Inventory;
