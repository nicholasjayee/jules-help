import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/lib/dummyData";

export interface GlobalInventoryStats {
  totalCostValue: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export const useGlobalInventoryStats = (businessId: string | undefined) => {
  return useQuery<GlobalInventoryStats>({
    queryKey: ["inventory_global_stats", businessId],
    queryFn: async (): Promise<GlobalInventoryStats> => {
      if (!businessId) {
        return {
          totalCostValue: 0,
          totalStockValue: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
        };
      }

      const products = await getProducts();

      let totalCostValue = 0;
      let totalStockValue = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      products.forEach(p => {
          totalCostValue += (p.costPrice || 0) * (p.quantity || 0);
          totalStockValue += (p.sellingPrice || 0) * (p.quantity || 0);
          if (p.quantity <= 0) outOfStockCount++;
          else if (p.quantity <= p.minimumStock) lowStockCount++;
      });

      return {
        totalCostValue,
        totalStockValue,
        lowStockCount,
        outOfStockCount,
      };
    },
    enabled: !!businessId,
  });
};
