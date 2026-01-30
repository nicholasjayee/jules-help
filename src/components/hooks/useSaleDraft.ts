import { useState, useEffect, useCallback, useMemo } from 'react';
import { SaleFormData } from '@/types';
import { useBusiness } from '@/contexts/BusinessContext';

export const useSaleDraft = () => {
  const [hasDraft, setHasDraft] = useState(false);
  const { currentBusiness } = useBusiness();

  const DRAFT_STORAGE_KEY = useMemo(() =>
    currentBusiness?.id ? `sale_draft_${currentBusiness.id}` : 'sale_draft'
    , [currentBusiness?.id]);

  // Check if draft exists
  const checkForDraft = useCallback(() => {
    const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
    const draftExists = !!draft;
    setHasDraft(draftExists);
    return draftExists;
  }, [DRAFT_STORAGE_KEY]);

  // Check for draft on mount and when business changes
  useEffect(() => {
    if (currentBusiness?.id) {
      checkForDraft();
    }
  }, [checkForDraft, currentBusiness?.id]);

  const saveDraft = useCallback((formData: SaleFormData, selectedDate: Date) => {
    if (!currentBusiness?.id) return;

    const draftData = {
      formData,
      selectedDate: selectedDate.toISOString(),
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
    setHasDraft(true);
  }, [DRAFT_STORAGE_KEY, currentBusiness?.id]);

  const loadDraft = useCallback(() => {
    const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (draft) {
      try {
        const parsedDraft = JSON.parse(draft);
        return {
          formData: parsedDraft.formData,
          selectedDate: new Date(parsedDraft.selectedDate),
          savedAt: new Date(parsedDraft.savedAt)
        };
      } catch (error) {
        console.error('Error parsing draft:', error);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setHasDraft(false);
        return null;
      }
    }
    return null;
  }, [DRAFT_STORAGE_KEY]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setHasDraft(false);
  }, [DRAFT_STORAGE_KEY]);

  return {
    hasDraft,
    saveDraft,
    loadDraft,
    clearDraft,
    checkForDraft
  };
};
