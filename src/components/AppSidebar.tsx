
import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import NavLinks from './header/NavLinks';
import { Building2, LogOut } from 'lucide-react';
import { BusinessSelector } from './business/BusinessSelector';
import { ProfileSelector } from './profiles/ProfileSelector';
import { useBusiness } from '@/contexts/BusinessContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from 'sonner';

const AppSidebar = () => {
  const { businessLocations } = useBusiness();
  const { signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Error during logout:', error);
      toast.error('Failed to logout. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="hidden border-r border-primary-foreground/20 bg-primary text-primary-foreground md:flex">
      <SidebarContent className="p-2 pt-6 flex flex-col">
        {businessLocations.length > 0 && (
          <div className="p-2 space-y-2">
            <BusinessSelector variant="sidebar" />
            <ProfileSelector />
          </div>
        )}
        <div className="flex-1">
          <NavLinks isSidebar={true} />
        </div>
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-primary-foreground/20">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full justify-start hover:bg-white/10 text-primary-foreground"
              tooltip={isLoggingOut ? "Logging out..." : "Logout"}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden truncate">{isLoggingOut ? "Logging out..." : "Logout"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="w-full justify-start hover:bg-white/10 text-primary-foreground" asChild tooltip="Manage Businesses">
              <Link to="/business-management">
                <Building2 className="mr-2 h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden truncate">Manage Businesses</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
export default AppSidebar;
