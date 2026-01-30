import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';

export interface BusinessProfile {
  id: string;
  business_location_id: string;
  profile_name: string;
  email: string;
  phone_number?: string;
  role: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ProfileContextType {
  profiles: BusinessProfile[];
  currentProfile: BusinessProfile | null;
  isLoading: boolean;
  setCurrentProfile: (profile: BusinessProfile | null) => void;
  loadProfiles: () => Promise<void>;
  createProfile: (data: Omit<BusinessProfile, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'business_location_id'>) => Promise<BusinessProfile | null>;
  updateProfile: (id: string, data: Partial<BusinessProfile>) => Promise<boolean>;
  deleteProfile: (id: string) => Promise<boolean>;
  toggleProfileStatus: (id: string, isActive: boolean) => Promise<boolean>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userId } = useCurrentUser();
  const { currentBusiness } = useBusiness();
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<BusinessProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadProfiles = async () => {
    if (!userId || !currentBusiness?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('business_location_id', currentBusiness.id)
        .eq('is_active', true)
        .order('profile_name');

      if (error) throw error;

      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast.error('Failed to load profiles');
    } finally {
      setIsLoading(false);
    }
  };

  const createProfile = async (data: Omit<BusinessProfile, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'business_location_id'>): Promise<BusinessProfile | null> => {
    if (!userId || !currentBusiness?.id) return null;

    try {
      const { data: newProfile, error } = await supabase
        .from('business_profiles')
        .insert({
          ...data,
          business_location_id: currentBusiness.id,
          created_by: userId
        })
        .select()
        .single();

      if (error) throw error;

      setProfiles(prev => [...prev, newProfile]);
      
      // Auto-select first profile if none is currently selected
      if (!currentProfile) {
        handleSetCurrentProfile(newProfile);
      }
      
      toast.success(`Profile "${data.profile_name}" created successfully`);
      return newProfile;
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile');
      return null;
    }
  };

  const updateProfile = async (id: string, data: Partial<BusinessProfile>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('business_profiles')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      setProfiles(prev => prev.map(profile => 
        profile.id === id ? { ...profile, ...data } : profile
      ));

      if (currentProfile?.id === id) {
        setCurrentProfile(prev => prev ? { ...prev, ...data } : null);
      }

      toast.success('Profile updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
      return false;
    }
  };

  const deleteProfile = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('business_profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProfiles(prev => prev.filter(profile => profile.id !== id));
      
      if (currentProfile?.id === id) {
        setCurrentProfile(null);
      }

      toast.success('Profile deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting profile:', error);
      toast.error('Failed to delete profile');
      return false;
    }
  };

  const toggleProfileStatus = async (id: string, isActive: boolean): Promise<boolean> => {
    return updateProfile(id, { is_active: isActive });
  };

  // Load profiles when business changes
  useEffect(() => {
    if (currentBusiness?.id) {
      loadProfiles();
      // Clear current profile when business changes
      setCurrentProfile(null);
    } else {
      setProfiles([]);
      setCurrentProfile(null);
    }
  }, [currentBusiness?.id, userId]);

  // Load current profile from localStorage or auto-select first profile
  useEffect(() => {
    if (profiles.length > 0 && currentBusiness?.id) {
      const savedProfileId = localStorage.getItem(`currentProfile_${currentBusiness.id}`);
      if (savedProfileId) {
        const profile = profiles.find(p => p.id === savedProfileId);
        if (profile) {
          setCurrentProfile(profile);
          return;
        }
      }
      
      // Auto-select first profile if none is saved and none is currently selected
      if (!currentProfile) {
        handleSetCurrentProfile(profiles[0]);
      }
    }
  }, [profiles, currentBusiness?.id]);

  // Save current profile to localStorage
  const handleSetCurrentProfile = (profile: BusinessProfile | null) => {
    setCurrentProfile(profile);
    if (currentBusiness?.id) {
      if (profile) {
        localStorage.setItem(`currentProfile_${currentBusiness.id}`, profile.id);
      } else {
        localStorage.removeItem(`currentProfile_${currentBusiness.id}`);
      }
    }
  };

  return (
    <ProfileContext.Provider value={{
      profiles,
      currentProfile,
      isLoading,
      setCurrentProfile: handleSetCurrentProfile,
      loadProfiles,
      createProfile,
      updateProfile,
      deleteProfile,
      toggleProfileStatus
    }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfiles = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfiles must be used within a ProfileProvider');
  }
  return context;
};