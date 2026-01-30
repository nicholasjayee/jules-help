
'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BusinessProvider } from '@/components/contexts/BusinessContext';
import { ProfileProvider } from '@/components/contexts/ProfileContext';
import { AuthProvider } from '@/components/auth/AuthProvider';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BusinessProvider>
          <ProfileProvider>
            <SidebarProvider>
              <TooltipProvider>
                {children}
              </TooltipProvider>
            </SidebarProvider>
          </ProfileProvider>
        </BusinessProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
