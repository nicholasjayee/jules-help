
export type ActivityType = 'CREATE' | 'UPDATE' | 'DELETE';
export type ModuleType = 'SALES' | 'INVENTORY' | 'EXPENSES' | 'FINANCE' | 'CUSTOMERS' | 'TASKS';

export interface ActivityLogData {
  activityType: ActivityType;
  module: ModuleType;
  entityType: string;
  entityId?: string;
  entityName: string;
  description: string;
  metadata?: any;
}

export const useActivityLogger = () => {
  const logActivity = async (data: ActivityLogData) => {
    console.log('Activity Logged:', data);
  };

  return { logActivity };
};
