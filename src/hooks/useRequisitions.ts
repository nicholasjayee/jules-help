"use client";
import { useState } from 'react';

export interface Requisition {
  id: string;
  items: any[];
  requisitionNumber: string;
  createdAt: Date;
  status: string;
  title?: string;
  notes?: string;
}

export const useRequisitions = (userId: string | undefined, businessId?: string) => {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  return {
    requisitions,
    isLoading: false,
    loadRequisitions: async () => {},
    createRequisition: async (title: string, items: any[], notes: string) => {},
    deleteRequisition: async (id: string) => {},
    updateRequisitionStatus: async (id: string, status: string) => {},
    clearRequisitions: async () => {},
  };
};
