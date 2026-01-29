"use client";
import React from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { BusinessProvider } from "@/contexts/BusinessContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BusinessProvider>
              {children}
              <Toaster />
            </BusinessProvider>
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
