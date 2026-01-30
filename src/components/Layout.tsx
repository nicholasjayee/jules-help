
'use client';

import React from "react";
import Header from "./Header";
import MobileNavigation from "./MobileNavigation";
import FloatingActionButton from "./FloatingActionButton";
import { useIsMobile } from "@/components/hooks/use-mobile";
import AppSidebar from "./AppSidebar";
import LoadingSpinner from "./LoadingSpinner";
import NetworkStatusIndicator from "./NetworkStatusIndicator";

const Layout = ({ children }: { children: React.ReactNode }) => {
  try {
    const isMobile = useIsMobile();

    // Contexts are provided by the parent Providers component
    return (
      <>
        {isMobile ? (
          // Mobile layout
          <div className="min-h-screen bg-gray-50 w-full">
            <Header />
            <NetworkStatusIndicator />
            <main className="pt-20 pb-20 min-h-screen">
              <div className="px-2 py-2 max-w-full overflow-x-hidden">
                <React.Suspense fallback={<LoadingSpinner message="Loading page..." />}>
                  {children}
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
                    {children}
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
      </>
    );
  } catch (error) {
    console.error('Layout rendering error:', error);

    // Fallback UI
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Loading...</h2>
            <LoadingSpinner message="Initializing app..." />
          </div>
        </div>
    );
  }
};

export default Layout;
