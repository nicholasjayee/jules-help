"use client";
import { useState } from 'react';

export const useSoldItemsData = (userId: string | undefined, dateFilter: any, dateRange: any, specificDate: any, showOnlyNotInInventory?: boolean) => {
  return {
    soldItems: [] as any[],
    isLoading: false,
    refetch: async () => {},
  };
};
