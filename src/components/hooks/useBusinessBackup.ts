import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';

interface BackupMetadata {
  version: string;
  timestamp: string;
  businessName: string;
  businessId: string;
  exportType: 'full_backup';
}

interface BackupData {
  metadata: BackupMetadata;
  data: Record<string, any[]>;
}

export const useBusinessBackup = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { user } = useAuth();
  const { currentBusiness } = useBusiness();

  const exportBusinessData = async () => {
    if (!user || !currentBusiness) {
      toast.error('No business selected for backup');
      return;
    }

    setIsExporting(true);
    setProgress(0);

    try {
      const data: Record<string, any[]> = {};
      let completed = 0;
      const totalTables = 17;
      
      // Export business settings
      try {
        const { data: businessSettings } = await supabase
          .from('business_settings')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.business_settings = businessSettings || [];
      } catch (error) {
        data.business_settings = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export products
      try {
        const { data: products } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.products = products || [];
      } catch (error) {
        data.products = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export product categories
      try {
        const { data: productCategories } = await supabase
          .from('product_categories')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.product_categories = productCategories || [];
      } catch (error) {
        data.product_categories = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export stock history
      try {
        const { data: stockHistory } = await supabase
          .from('stock_history')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.stock_history = stockHistory || [];
      } catch (error) {
        data.stock_history = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export sales
      try {
        const { data: sales } = await supabase
          .from('sales')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.sales = sales || [];
      } catch (error) {
        data.sales = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export installment payments
      try {
        const { data: installmentPayments } = await supabase
          .from('installment_payments')
          .select('*')
          .eq('user_id', user.id);
        data.installment_payments = installmentPayments || [];
      } catch (error) {
        data.installment_payments = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export customers
      try {
        const { data: customers } = await supabase
          .from('customers')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.customers = customers || [];
      } catch (error) {
        data.customers = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export customer categories
      try {
        const { data: customerCategories } = await supabase
          .from('customer_categories')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.customer_categories = customerCategories || [];
      } catch (error) {
        data.customer_categories = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export expenses
      try {
        const { data: expenses } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.expenses = expenses || [];
      } catch (error) {
        data.expenses = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export expense categories
      try {
        const { data: expenseCategories } = await supabase
          .from('expense_categories')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.expense_categories = expenseCategories || [];
      } catch (error) {
        data.expense_categories = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export cash accounts
      try {
        const { data: cashAccounts } = await supabase
          .from('cash_accounts')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.cash_accounts = cashAccounts || [];
      } catch (error) {
        data.cash_accounts = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export cash transactions
      try {
        const { data: cashTransactions } = await supabase
          .from('cash_transactions')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.cash_transactions = cashTransactions || [];
      } catch (error) {
        data.cash_transactions = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export carriage inwards
      try {
        const { data: carriageInwards } = await supabase
          .from('carriage_inwards')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.carriage_inwards = carriageInwards || [];
      } catch (error) {
        data.carriage_inwards = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export tasks
      try {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.tasks = tasks || [];
      } catch (error) {
        data.tasks = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export task categories
      try {
        const { data: taskCategories } = await supabase
          .from('task_categories')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.task_categories = taskCategories || [];
      } catch (error) {
        data.task_categories = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export sales goals
      try {
        const { data: salesGoals } = await supabase
          .from('sales_goals')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.sales_goals = salesGoals || [];
      } catch (error) {
        data.sales_goals = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Export notification preferences
      try {
        const { data: notificationPreferences } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .eq('location_id', currentBusiness.id);
        data.notification_preferences = notificationPreferences || [];
      } catch (error) {
        data.notification_preferences = [];
      }
      completed++;
      setProgress((completed / totalTables) * 90);

      // Add user profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      data.profiles = profileData ? [profileData] : [];

      const backupData: BackupData = {
        metadata: {
          version: '1.0',
          timestamp: new Date().toISOString(),
          businessName: currentBusiness.name,
          businessId: currentBusiness.id,
          exportType: 'full_backup'
        },
        data
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentBusiness.name.replace(/[^a-zA-Z0-9]/g, '_')}_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setProgress(100);
      toast.success('Backup completed successfully');
      
    } catch (error) {
      console.error('Backup failed:', error);
      toast.error('Backup failed. Please try again.');
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  };

  const importBusinessData = async (file: File) => {
    if (!user || !currentBusiness) {
      toast.error('No business selected for restore');
      return false;
    }

    setIsImporting(true);
    setProgress(0);

    try {
      const fileContent = await file.text();
      const backupData: BackupData = JSON.parse(fileContent);

      // Validate backup file
      if (!backupData.metadata || !backupData.data) {
        throw new Error('Invalid backup file format');
      }

      if (backupData.metadata.version !== '1.0') {
        throw new Error('Unsupported backup version');
      }

      const tables = Object.keys(backupData.data);
      let completed = 0;

      // Clear existing data (be careful with order due to foreign keys)
      await supabase.from('installment_payments').delete().eq('user_id', user.id);
      await supabase.from('stock_history').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);
      await supabase.from('sales').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);
      await supabase.from('cash_transactions').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);
      await supabase.from('carriage_inwards').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);
      await supabase.from('expenses').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);
      await supabase.from('tasks').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);
      await supabase.from('products').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);
      await supabase.from('customers').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);
      await supabase.from('cash_accounts').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);
      await supabase.from('product_categories').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);
      await supabase.from('customer_categories').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);
      await supabase.from('expense_categories').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);
      await supabase.from('task_categories').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);
      await supabase.from('sales_goals').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);
      await supabase.from('business_settings').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);
      await supabase.from('notification_preferences').delete().eq('user_id', user.id).eq('location_id', currentBusiness.id);

      setProgress(30);

      // Import data in correct order
      const importTables = [
        'business_settings',
        'notification_preferences', 
        'sales_goals',
        'task_categories',
        'expense_categories',
        'customer_categories',
        'product_categories',
        'cash_accounts',
        'customers',
        'products',
        'tasks',
        'expenses',
        'carriage_inwards',
        'cash_transactions',
        'sales',
        'stock_history',
        'installment_payments'
      ];
      
      let importCompleted = 0;
      
      for (const table of importTables) {
        if (backupData.data[table] && backupData.data[table].length > 0) {
          try {
            const tableData = backupData.data[table].map(record => {
              const newRecord = { ...record };
              
              // Update location_id to current business for location-specific tables
              if (newRecord.location_id) {
                newRecord.location_id = currentBusiness.id;
              }
              
              // Preserve created_at to maintain original order, only remove updated_at
              delete newRecord.updated_at;
              
              return newRecord;
            });

            // Use explicit table names for TypeScript
            if (table === 'business_settings') {
              // Business settings need special handling for user_id and location_id
              const businessSettingsData = tableData.map(record => ({
                ...record,
                user_id: user.id,
                location_id: currentBusiness.id
              }));
              await supabase.from('business_settings').upsert(businessSettingsData, {
                onConflict: 'location_id'
              });
            } else if (table === 'products') {
              await supabase.from('products').insert(tableData);
            } else if (table === 'sales') {
              await supabase.from('sales').insert(tableData);
            } else if (table === 'customers') {
              await supabase.from('customers').insert(tableData);
            } else if (table === 'expenses') {
              // Expenses need location_id updated to current business
              const expensesData = tableData.map(record => ({
                ...record,
                user_id: user.id,
                location_id: currentBusiness.id
              }));
              await supabase.from('expenses').insert(expensesData);
            } else if (table === 'cash_accounts') {
              await supabase.from('cash_accounts').insert(tableData);
            } else if (table === 'cash_transactions') {
              await supabase.from('cash_transactions').insert(tableData);
            } else if (table === 'tasks') {
              await supabase.from('tasks').insert(tableData);
            } else if (table === 'carriage_inwards') {
              await supabase.from('carriage_inwards').insert(tableData);
            } else if (table === 'stock_history') {
              await supabase.from('stock_history').insert(tableData);
            } else if (table === 'installment_payments') {
              await supabase.from('installment_payments').insert(tableData);
            } else if (table === 'product_categories') {
              await supabase.from('product_categories').insert(tableData);
            } else if (table === 'customer_categories') {
              await supabase.from('customer_categories').insert(tableData);
            } else if (table === 'expense_categories') {
              await supabase.from('expense_categories').insert(tableData);
            } else if (table === 'task_categories') {
              await supabase.from('task_categories').insert(tableData);
            } else if (table === 'sales_goals') {
              await supabase.from('sales_goals').insert(tableData);
            } else if (table === 'notification_preferences') {
              await supabase.from('notification_preferences').insert(tableData);
            }
          } catch (error) {
            console.warn(`Error importing ${table}:`, error);
          }
        }
        
        importCompleted++;
        setProgress(30 + (importCompleted / importTables.length) * 70);
      }

      toast.success('Data restored successfully');
      setTimeout(() => window.location.reload(), 1000);
      return true;
      
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Import failed. Please check the backup file.');
      return false;
    } finally {
      setIsImporting(false);
      setProgress(0);
    }
  };

  return {
    exportBusinessData,
    importBusinessData,
    isExporting,
    isImporting,
    progress
  };
};