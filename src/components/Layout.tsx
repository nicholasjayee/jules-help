
import React from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import MobileNavigation from "./MobileNavigation";
import FloatingActionButton from "./FloatingActionButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "./ui/sidebar";
import AppSidebar from "./AppSidebar";
import LoadingSpinner from "./LoadingSpinner";
import NetworkStatusIndicator from "./NetworkStatusIndicator";

const Layout = () => {
  try {
    const isMobile = useIsMobile();

    // Always wrap with SidebarProvider to ensure context is available
    return (
      <SidebarProvider>
        <TooltipProvider>
          {isMobile ? (
            // Mobile layout
            <div className="min-h-screen bg-gray-50 w-full">
              <Header />
              <NetworkStatusIndicator />
              <main className="pt-20 pb-20 min-h-screen">
                <div className="px-2 py-2 max-w-full overflow-x-hidden">
                  <React.Suspense fallback={<LoadingSpinner message="Loading page..." />}>
                    <Outlet />
                  </React.Suspense>
                </div>
              </main>
              <footer className="fixed bottom-0 left-0 right-0 bg-background border-t text-center text-xs text-muted-foreground py-2 mb-16 z-40">
                © {new Date().getFullYear()} Gonza Systems. All rights reserved.
              </footer>
              <MobileNavigation />
            </div>
          ) : (
            // Desktop layout
            <div className="flex min-h-screen w-full">
              <AppSidebar />
              <div className="flex flex-1 flex-col min-h-screen min-w-0">
                <Header />
                <NetworkStatusIndicator />
                <main className="flex-1 bg-gray-50 p-6 overflow-auto">
                  <div className="w-full">
                    <React.Suspense fallback={<LoadingSpinner message="Loading page..." />}>
                      <Outlet />
                    </React.Suspense>
                  </div>
                </main>
                <footer className="bg-background border-t text-center text-xs text-muted-foreground py-3">
                  © {new Date().getFullYear()} Gonza Systems. All rights reserved.
                </footer>
              </div>
              <FloatingActionButton />
            </div>
          )}
        </TooltipProvider>
      </SidebarProvider>
    );
  } catch (error) {
    console.error('Layout rendering error:', error);

    // Fallback UI in case of errors with SidebarProvider
    return (
      <SidebarProvider>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Loading...</h2>
            <LoadingSpinner message="Initializing app..." />
          </div>
        </div>
      </SidebarProvider>
    );
  }
};

export default Layout;
