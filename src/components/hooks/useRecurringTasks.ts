
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/task';
import { addDays, addWeeks, addMonths, format, parseISO } from 'date-fns';
import { toast } from 'sonner';

export const useRecurringTasks = () => {
  const createRecurringInstances = useCallback(async (task: Task) => {
    if (!task.is_recurring || !task.recurrence_type || !task.recurrence_end_date) {
      return;
    }

    const instances: Omit<Task, 'id' | 'created_at' | 'updated_at'>[] = [];
    let currentDate = parseISO(task.due_date);
    const endDate = parseISO(task.recurrence_end_date);
    let count = 0;

    while (currentDate <= endDate && count < 365) { // Safety limit
      let nextDate: Date;
      
      switch (task.recurrence_type) {
        case 'daily':
          nextDate = addDays(currentDate, 1);
          break;
        case 'weekly':
          nextDate = addWeeks(currentDate, 1);
          break;
        case 'monthly':
          nextDate = addMonths(currentDate, 1);
          break;
        default:
          return;
      }

      if (nextDate > endDate) break;

      instances.push({
        user_id: task.user_id,
        location_id: task.location_id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        due_date: format(nextDate, 'yyyy-MM-dd'),
        category: task.category,
        completed: false,
        completed_at: null,
        reminder_enabled: task.reminder_enabled,
        reminder_time: task.reminder_time,
        is_recurring: false, // Instances are not recurring themselves
        recurrence_type: null,
        recurrence_end_date: null,
        parent_task_id: task.id,
        recurrence_count: count + 1,
      });

      currentDate = nextDate;
      count++;
    }

    if (instances.length > 0) {
      try {
        const { error } = await supabase
          .from('tasks')
          .insert(instances);

        if (error) throw error;

        toast.success(`Created ${instances.length} recurring task instances`);
      } catch (error) {
        console.error('Error creating recurring task instances:', error);
        toast.error('Failed to create recurring task instances');
      }
    }
  }, []);

  const deleteRecurringInstances = useCallback(async (parentTaskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('parent_task_id', parentTaskId)
        .eq('completed', false);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting recurring task instances:', error);
      toast.error('Failed to delete recurring task instances');
    }
  }, []);

  return {
    createRecurringInstances,
    deleteRecurringInstances,
  };
};
