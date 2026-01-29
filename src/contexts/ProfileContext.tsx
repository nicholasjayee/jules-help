import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
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
  const { user } = useAuth();
  const userId = user?.id;
  const { currentBusiness } = useBusiness();
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<BusinessProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadProfiles = async () => {
    if (!userId || !currentBusiness?.id) return;

    setIsLoading(true);
    try {
        // Mock profiles
        const mockProfiles: BusinessProfile[] = [
            {
                id: 'prof-1',
                business_location_id: currentBusiness.id,
                profile_name: 'Manager',
                email: 'manager@example.com',
                role: 'admin',
                is_active: true,
                created_by: userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        ];
      setProfiles(mockProfiles);
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast.error('Failed to load profiles');
    } finally {
      setIsLoading(false);
    }
  };

  const createProfile = async (data: Omit<BusinessProfile, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'business_location_id'>): Promise<BusinessProfile | null> => {
    if (!userId || !currentBusiness?.id) return null;

    const newProfile: BusinessProfile = {
        id: `prof-${Date.now()}`,
        business_location_id: currentBusiness.id,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...data
    };

    setProfiles(prev => [...prev, newProfile]);
    if (!currentProfile) handleSetCurrentProfile(newProfile);
    toast.success(`Profile "${data.profile_name}" created successfully`);
    return newProfile;
  };

  const updateProfile = async (id: string, data: Partial<BusinessProfile>): Promise<boolean> => {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    if (currentProfile?.id === id) {
        setCurrentProfile(prev => prev ? { ...prev, ...data } : null);
    }
    toast.success('Profile updated successfully');
    return true;
  };

  const deleteProfile = async (id: string): Promise<boolean> => {
    setProfiles(prev => prev.filter(p => p.id !== id));
    if (currentProfile?.id === id) setCurrentProfile(null);
    toast.success('Profile deleted successfully');
    return true;
  };

  const toggleProfileStatus = async (id: string, isActive: boolean): Promise<boolean> => {
    return updateProfile(id, { is_active: isActive });
  };

  useEffect(() => {
    if (currentBusiness?.id) {
      loadProfiles();
      setCurrentProfile(null);
    } else {
      setProfiles([]);
      setCurrentProfile(null);
    }
  }, [currentBusiness?.id, userId]);

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
      if (!currentProfile) {
        handleSetCurrentProfile(profiles[0]);
      }
    }
  }, [profiles, currentBusiness?.id]);

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
