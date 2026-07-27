import { useState, useEffect, useRef, useCallback } from 'react';

function trimValues<T>(values: T): T {
  if (typeof values !== 'object' || values === null) return values;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
    result[key] = typeof value === 'string' ? value.trim() : value;
  }
  return result as T;
}

export function useUnsavedChanges<T>(
  currentValues: T,
  isNew: boolean = false
) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const originalValues = useRef<T | null>(null);
  const initializedFromData = useRef(false);

  useEffect(() => {
    if (!isNew && originalValues.current === null) {
      originalValues.current = JSON.parse(JSON.stringify(trimValues(currentValues)));
    }
  }, [isNew, currentValues]);

  useEffect(() => {
    if (isNew) {
      const hasAnyValue = Object.values(currentValues as any).some((value) => {
        if (typeof value === 'string') return value.trim().length > 0;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'boolean') return value !== false;
        if (Array.isArray(value)) return value.length > 0;
        return false;
      });
      setHasUnsavedChanges(hasAnyValue);
    } else if (originalValues.current !== null) {
      const trimmedCurrent = trimValues(currentValues);
      const hasChanges = JSON.stringify(trimmedCurrent) !== JSON.stringify(originalValues.current);
      setHasUnsavedChanges(hasChanges);
    }
  }, [currentValues, isNew]);

  const setInitialValues = useCallback((values: T) => {
    originalValues.current = JSON.parse(JSON.stringify(trimValues(values)));
    initializedFromData.current = true;
    const trimmedCurrent = trimValues(currentValues);
    const hasChanges = JSON.stringify(trimmedCurrent) !== JSON.stringify(originalValues.current);
    setHasUnsavedChanges(hasChanges);
  }, [currentValues]);

  const handleExitAttempt = () => {
    if (hasUnsavedChanges) {
      setShowDiscardModal(true);
      return false;
    }
    return true;
  };

  const handleDiscard = () => {
    setShowDiscardModal(false);
    return true;
  };

  const handleKeepEditing = () => {
    setShowDiscardModal(false);
    return false;
  };

  const resetChanges = useCallback(() => {
    originalValues.current = JSON.parse(JSON.stringify(trimValues(currentValues)));
    setHasUnsavedChanges(false);
    setShowDiscardModal(false);
  }, [currentValues]);

  return {
    hasUnsavedChanges,
    showDiscardModal,
    handleExitAttempt,
    handleDiscard,
    handleKeepEditing,
    resetChanges,
    setInitialValues,
  };
}
