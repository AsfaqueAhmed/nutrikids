'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useChildren, Child } from './useChildren';

const ACTIVE_CHILD_KEY = 'nk.activeChild';

export function useActiveChild() {
  const { children, isLoading } = useChildren();
  const [storedId, setStoredId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_CHILD_KEY);
  });

  const activeChild = useMemo<Child | null>(() => {
    if (!children.length) return null;
    if (storedId) {
      const match = children.find((c) => c.id === storedId);
      if (match) return match;
    }
    return children[0];
  }, [children, storedId]);

  useEffect(() => {
    if (activeChild && activeChild.id !== storedId) {
      setStoredId(activeChild.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_CHILD_KEY, activeChild.id);
      }
    }
  }, [activeChild, storedId]);

  const setActiveChildId = useCallback((id: string) => {
    setStoredId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_CHILD_KEY, id);
    }
  }, []);

  return {
    children,
    activeChild,
    activeChildId: activeChild?.id ?? null,
    setActiveChildId,
    isLoading,
  };
}
