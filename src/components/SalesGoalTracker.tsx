import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useBusiness } from "@/components/contexts/BusinessContext";
import { useBusinessSettings } from "@/components/hooks/useBusinessSettings";
import { toast } from "sonner";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import BusinessGoalsTip from "@/components/BusinessGoalsTip";
type GoalType = 'daily' | 'weekly' | 'monthly';
interface GoalContentProps {
  goalType: GoalType;
  isLoading: boolean;
  currentGoal: number;
  currentSales: number;
  progress: number;
  periodLabel: string;
  formatCurrency: (amount: number) => string;
  goalInput: string;
  onGoalInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpdateGoal: () => void;
  isUpdating: boolean;
}
const GoalContent = React.memo<GoalContentProps>(({
  goalType,
  isLoading,
  currentGoal,
  currentSales,
  progress,
  periodLabel,
  formatCurrency,
  goalInput,
  onGoalInputChange,
  onUpdateGoal,
  isUpdating
}) => <div className="space-y-4">
    <div className="text-sm text-muted-foreground">{periodLabel}</div>

    {isLoading ? <div className="text-center py-4">
      <p className="text-muted-foreground">Loading sales data...</p>
    </div> : <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{goalType.charAt(0).toUpperCase() + goalType.slice(1)} Goal</span>
        <span className="text-sm font-bold">{formatCurrency(currentGoal)}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Current Sales</span>
        <span className="text-sm font-bold">{formatCurrency(currentSales || 0)}</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-sm font-bold">{progress.toFixed(1)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Input key={`${goalType}-input`} type="number" placeholder={`Enter ${goalType} goal amount`} value={goalInput} onChange={onGoalInputChange} min="0" step="0.01" className="flex-1" />
          <Button onClick={onUpdateGoal} disabled={isUpdating || !goalInput.trim()}>
            {isUpdating ? "Updating..." : "Set Goal"}
          </Button>
        </div>
      </div>

      {currentGoal > 0 && <div className="text-xs text-muted-foreground">
        {currentSales >= currentGoal ? <span className="text-green-600 font-medium">🎉 Goal achieved!</span> : <span>
          {formatCurrency(currentGoal - (currentSales || 0))} remaining to reach goal
        </span>}
      </div>}
    </>}
  </div>);
GoalContent.displayName = 'GoalContent';
const SalesGoalTracker = () => {
  const {
    user
  } = useAuth();
  const {
    currentBusiness
  } = useBusiness();
  const {
    settings
  } = useBusinessSettings();
  const queryClient = useQueryClient();

  // Make date values reactive instead of static
  const [currentDate] = useState(() => new Date());
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const [goalInput, setGoalInput] = useState("");
  const [selectedGoalType, setSelectedGoalType] = useState<GoalType>('monthly');

  // Clear goal input when business changes
  useEffect(() => {
    setGoalInput("");
  }, [currentBusiness?.id]);

  // Fetch current sales goal with proper dependency array
  const {
    data: salesGoal,
    isLoading: goalLoading
  } = useQuery({
    queryKey: ["sales-goal", user?.id, currentBusiness?.id, currentMonth, currentYear],
    queryFn: async () => {
      if (!user?.id || !currentBusiness?.id) return null;

      const {
        data,
        error
      } = await supabase.from("sales_goals").select("*").eq("user_id", user.id).eq("location_id", currentBusiness.id).eq("month", currentMonth).eq("year", currentYear).maybeSingle();
      if (error) {
        console.error("Error fetching sales goal:", error);
        throw error;
      }
      return data;
    },
    enabled: !!user?.id && !!currentBusiness?.id,
    staleTime: 30000 // Cache for 30 seconds
  });

  // Fetch current period sales based on selected goal type
  const {
    data: currentSales,
    isLoading: salesLoading
  } = useQuery({
    queryKey: ["current-period-sales", user?.id, currentBusiness?.id, selectedGoalType, currentMonth, currentYear],
    queryFn: async () => {
      if (!user?.id || !currentBusiness?.id) return 0;

      // Calculate date range based on selected goal type
      let startDate: Date, endDate: Date;
      switch (selectedGoalType) {
        case 'daily':
          startDate = startOfDay(currentDate);
          endDate = endOfDay(currentDate);
          break;
        case 'weekly':
          startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
          endDate = endOfWeek(currentDate, { weekStartsOn: 1 });
          break;
        case 'monthly':
          startDate = startOfMonth(currentDate);
          endDate = endOfMonth(currentDate);
          break;
      }

      // Load all sales with chunked pagination
      let allSales: any[] = [];
      let paginationStart = 0;
      const chunkSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: chunk, error: chunkError } = await supabase
          .from("sales")
          .select("items")
          .eq("user_id", user.id)
          .eq("location_id", currentBusiness.id)
          .gte("date", startDate.toISOString())
          .lte("date", endDate.toISOString())
          .neq("payment_status", "Quote")
          .range(paginationStart, paginationStart + chunkSize - 1);

        if (chunkError) {
          console.error("Error fetching sales chunk:", chunkError);
          throw chunkError;
        }

        if (chunk && chunk.length > 0) {
          allSales.push(...chunk);
          paginationStart += chunkSize;
          hasMore = chunk.length === chunkSize;
        } else {
          hasMore = false;
        }
      }

      const total = allSales.reduce((sum, sale) => {
        const items = Array.isArray(sale.items) ? sale.items : [];
        const saleTotal = items.reduce((itemSum: number, item: any) => {
          const price = typeof item.price === 'number' ? item.price : 0;
          const quantity = typeof item.quantity === 'number' ? item.quantity : 0;
          return itemSum + price * quantity;
        }, 0);
        const validSaleTotal = typeof saleTotal === 'number' ? saleTotal : 0;
        return sum + validSaleTotal;
      }, 0);
      return total;
    },
    enabled: !!user?.id && !!currentBusiness?.id,
    staleTime: 30000 // Cache for 30 seconds
  });

  // Update sales goal mutation with the correct constraint name
  const updateGoalMutation = useMutation({
    mutationFn: async ({
      goalType,
      amount
    }: {
      goalType: GoalType;
      amount: number;
    }) => {
      if (!user?.id || !currentBusiness?.id) {
        throw new Error("User or location not available");
      }

      // Prepare the goal data - preserve existing values when updating
      const baseData = {
        user_id: user.id,
        location_id: currentBusiness.id,
        month: currentMonth,
        year: currentYear,
        updated_at: new Date().toISOString()
      };

      // Build the goal data with only the specific goal type being updated
      const goalData = {
        ...baseData,
        daily_goal: goalType === 'daily' ? amount : salesGoal?.daily_goal || 0,
        weekly_goal: goalType === 'weekly' ? amount : salesGoal?.weekly_goal || 0,
        monthly_goal: goalType === 'monthly' ? amount : salesGoal?.monthly_goal || 0
      };

      // Use UPSERT with the correct constraint name that allows per-location goals
      const {
        data,
        error
      } = await supabase.from("sales_goals").upsert(goalData, {
        onConflict: 'user_id,location_id,month,year',
        ignoreDuplicates: false
      }).select().single();
      if (error) {
        console.error("Error upserting sales goal:", error);
        throw error;
      }
      return data;
    },
    onSuccess: data => {
      toast.success(`${selectedGoalType.charAt(0).toUpperCase() + selectedGoalType.slice(1)} goal updated successfully!`);

      // Invalidate and refetch queries
      queryClient.invalidateQueries({
        queryKey: ["sales-goal", user?.id, currentBusiness?.id, currentMonth, currentYear]
      });
      queryClient.invalidateQueries({
        queryKey: ["current-period-sales", user?.id, currentBusiness?.id, selectedGoalType, currentMonth, currentYear]
      });
      setGoalInput("");
    },
    onError: (error: any) => {
      console.error("Failed to update sales goal:", error);

      // Provide more specific error messages
      let errorMessage = "Failed to update sales goal. Please try again.";
      if (error.message?.includes("permission denied") || error.message?.includes("policy")) {
        errorMessage = "Permission denied. Please ensure you have access to modify goals for this business.";
      } else if (error.message?.includes("unique constraint") || error.code === "23505") {
        errorMessage = "Failed to update goal. Please refresh the page and try again.";
      } else if (error.message?.includes("location_id")) {
        errorMessage = "Invalid business location. Please select a valid business.";
      } else if (error.message?.includes("violates")) {
        errorMessage = "Database constraint violation. Please contact support if this persists.";
      }
      toast.error(errorMessage);
    }
  });
  const handleGoalInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Allow empty string, numbers, and decimal points
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setGoalInput(value);
    }
  };
  const handleUpdateGoal = () => {
    const goal = parseFloat(goalInput);
    if (isNaN(goal) || goal < 0) {
      toast.error("Please enter a valid goal amount");
      return;
    }
    updateGoalMutation.mutate({
      goalType: selectedGoalType,
      amount: goal
    });
  };
  const handleTabChange = (value: string) => {
    setSelectedGoalType(value as GoalType);
  };

  // Get current goal based on selected type
  const getCurrentGoal = () => {
    if (!salesGoal) return 0;
    switch (selectedGoalType) {
      case 'daily':
        return salesGoal.daily_goal || 0;
      case 'weekly':
        return salesGoal.weekly_goal || 0;
      case 'monthly':
        return salesGoal.monthly_goal || 0;
      default:
        return 0;
    }
  };
  const currentGoal = getCurrentGoal();
  const progress = useMemo(() =>
    currentGoal > 0 ? Math.min((currentSales || 0) / currentGoal * 100, 100) : 0,
    [currentGoal, currentSales]
  );
  const isLoading = goalLoading || salesLoading;

  // Memoize period label
  const periodLabel = useMemo(() => {
    switch (selectedGoalType) {
      case 'daily':
        return format(currentDate, 'MMMM d, yyyy');
      case 'weekly':
        return `Week of ${format(startOfWeek(currentDate, {
          weekStartsOn: 1
        }), 'MMM d')}`;
      case 'monthly':
        return format(currentDate, 'MMMM yyyy');
      default:
        return '';
    }
  }, [selectedGoalType, currentDate]);

  const formatCurrency = useMemo(() => (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings?.currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  }, [settings?.currency]);

  // Early return after all hooks have been called
  if (!user || !currentBusiness) {
    return <Card>
      <CardHeader>
        <CardTitle>Sales Goal Tracker</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Please select a business location to track sales goals.</p>
      </CardContent>
    </Card>;
  }
  return <Card>
    <CardHeader>
      <CardTitle>Gonza Sales Goal Tracker</CardTitle>
      <div className="text-sm text-muted-foreground">
        Business: {currentBusiness.name}
      </div>
    </CardHeader>
    <CardContent>
      <Tabs value={selectedGoalType} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <GoalContent goalType="daily" isLoading={isLoading} currentGoal={currentGoal} currentSales={currentSales || 0} progress={progress} periodLabel={periodLabel} formatCurrency={formatCurrency} goalInput={goalInput} onGoalInputChange={handleGoalInputChange} onUpdateGoal={handleUpdateGoal} isUpdating={updateGoalMutation.isPending} />
        </TabsContent>

        <TabsContent value="weekly">
          <GoalContent goalType="weekly" isLoading={isLoading} currentGoal={currentGoal} currentSales={currentSales || 0} progress={progress} periodLabel={periodLabel} formatCurrency={formatCurrency} goalInput={goalInput} onGoalInputChange={handleGoalInputChange} onUpdateGoal={handleUpdateGoal} isUpdating={updateGoalMutation.isPending} />
        </TabsContent>

        <TabsContent value="monthly">
          <GoalContent goalType="monthly" isLoading={isLoading} currentGoal={currentGoal} currentSales={currentSales || 0} progress={progress} periodLabel={periodLabel} formatCurrency={formatCurrency} goalInput={goalInput} onGoalInputChange={handleGoalInputChange} onUpdateGoal={handleUpdateGoal} isUpdating={updateGoalMutation.isPending} />
        </TabsContent>
      </Tabs>

      {/* Add Business Goals Tip */}
      <BusinessGoalsTip />
    </CardContent>
  </Card>;
};
export default SalesGoalTracker;
