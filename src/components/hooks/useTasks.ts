
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Task, CreateTaskData, UpdateTaskData } from '@/types/task';
import { useAuth } from '@/components/auth/AuthProvider';
import { useBusiness } from '@/contexts/BusinessContext';
import { useRecurringTasks } from '@/hooks/useRecurringTasks';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const { user } = useAuth();
  const { currentBusiness } = useBusiness();
  const { createRecurringInstances, deleteRecurringInstances } = useRecurringTasks();
  const queryClient = useQueryClient();

  const loadTasks = useCallback(async (): Promise<Task[]> => {
    if (!user?.id || !currentBusiness?.id) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('location_id', currentBusiness.id)
        .order('due_date', { ascending: true });

      if (error) throw error;

      return (data || []) as Task[];
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Failed to load tasks');
      return [];
    }
  }, [user?.id, currentBusiness?.id]);

  // React Query caching
  const queryKey = ['tasks', user?.id, currentBusiness?.id];
  const { data: queriedTasks, isLoading: isQueryLoading, isFetching } = useQuery({
    queryKey,
    queryFn: loadTasks,
    enabled: !!user?.id && !!currentBusiness?.id,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (queriedTasks) {
      setTasks(queriedTasks);
    }
  }, [queriedTasks]);

  // Derived loading state to prevent flash when background fetching
  const isLoading = isQueryLoading && !queriedTasks;

  const createTask = async (taskData: CreateTaskData): Promise<Task | null> => {
    if (!user?.id || !currentBusiness?.id) return null;

    try {
      // Clean the task data to handle empty reminder_time
      const cleanTaskData = {
        ...taskData,
        reminder_time: taskData.reminder_time && taskData.reminder_time.trim() !== '' 
          ? taskData.reminder_time 
          : null,
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          location_id: currentBusiness.id,
          ...cleanTaskData,
        })
        .select()
        .single();

      if (error) throw error;

      const newTask = data as Task;
      
      // Create recurring instances if this is a recurring task
      if (newTask.is_recurring) {
        await createRecurringInstances(newTask);
      }

      // Update local state immediately
      setTasks(prev => [newTask, ...prev]);

      // Update React Query cache immediately
      queryClient.setQueryData(queryKey, (oldData: Task[] | undefined) => {
        return oldData ? [newTask, ...oldData] : [newTask];
      });
      
      toast.success('Task created successfully');
      return newTask;
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
      return null;
    }
  };

  const updateTask = async (id: string, updates: UpdateTaskData): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      // Clean the updates to handle empty reminder_time
      const cleanUpdates = {
        ...updates,
        reminder_time: updates.reminder_time !== undefined 
          ? (updates.reminder_time && updates.reminder_time.trim() !== '' ? updates.reminder_time : null)
          : undefined,
      };

      const { data, error } = await supabase
        .from('tasks')
        .update(cleanUpdates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      const updatedTask = data as Task;

      // If this is a recurring task and we're updating its recurrence settings
      if (updatedTask.is_recurring && (updates.recurrence_type || updates.recurrence_end_date)) {
        // Delete existing instances and create new ones
        await deleteRecurringInstances(id);
        await createRecurringInstances(updatedTask);
      }

      // Update local state immediately
      setTasks(prev => prev.map(t => t.id === id ? updatedTask : t));

      // Update React Query cache immediately
      queryClient.setQueryData(queryKey, (oldData: Task[] | undefined) => {
        return oldData ? oldData.map(t => t.id === id ? updatedTask : t) : [updatedTask];
      });

      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
      return false;
    }
  };

  const toggleTaskCompletion = async (id: string): Promise<boolean> => {
    const task = tasks.find(t => t.id === id);
    if (!task) return false;

    const updates: UpdateTaskData = {
      completed: !task.completed,
      completed_at: !task.completed ? new Date().toISOString() : null,
    };

    const success = await updateTask(id, updates);
    
    if (success) {
      if (!task.completed) {
        toast.success('Well done! 🎉 Task completed');
      } else {
        toast.success('Task marked as pending');
      }
    }
    
    return success;
  };

  const deleteTask = async (id: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const task = tasks.find(t => t.id === id);
      
      // If this is a recurring task, delete its instances too
      if (task?.is_recurring) {
        await deleteRecurringInstances(id);
      }

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey });
      toast.success('Task deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
      return false;
    }
  };

  const bulkUpdateTasks = async (taskIds: string[], updates: UpdateTaskData): Promise<boolean> => {
    if (!user?.id || taskIds.length === 0) return false;

    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .in('id', taskIds)
        .eq('user_id', user.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey });
      toast.success(`Updated ${taskIds.length} tasks`);
      return true;
    } catch (error) {
      console.error('Error bulk updating tasks:', error);
      toast.error('Failed to update tasks');
      return false;
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!user?.id || !currentBusiness?.id) return;

    const channel = supabase
      .channel('tasks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, currentBusiness?.id, queryClient, queryKey]);

  const refreshTasks = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    tasks,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    bulkUpdateTasks,
    refreshTasks,
  };
};
