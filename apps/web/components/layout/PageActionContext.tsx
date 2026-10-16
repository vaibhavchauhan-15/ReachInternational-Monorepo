"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface PageCustomAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  run: () => void | Promise<void>;
  variant?: "default" | "danger" | "warning";
  disabled?: boolean;
}

export interface PageActions {
  /** Primary Add (+) action */
  onAdd?: () => void | Promise<void>;
  addLabel?: string;

  /** Export Actions */
  onExportExcel?: () => void | Promise<void>;
  onExportCSV?: () => void | Promise<void>;
  onExportPDF?: () => void | Promise<void>;
  onPrint?: () => void | Promise<void>;

  /** Refresh Data */
  onRefresh?: () => void | Promise<void>;

  /** Quick Operations Action (e.g. Assign Operator) */
  onQuickAssign?: () => void | Promise<void>;

  /** Additional Contextual Menu Actions */
  customActions?: PageCustomAction[];
}

interface PageActionContextValue {
  actions: PageActions | null;
  registerActions: (actions: PageActions) => () => void;
}

const PageActionContext = createContext<PageActionContextValue>({
  actions: null,
  registerActions: () => () => {},
});

export function PageActionProvider({ children }: { children: React.ReactNode }) {
  const [actions, setActions] = useState<PageActions | null>(null);

  const registerActions = useCallback((newActions: PageActions) => {
    setActions(newActions);
    return () => {
      setActions((prev) => (prev === newActions ? null : prev));
    };
  }, []);

  return (
    <PageActionContext.Provider value={{ actions, registerActions }}>
      {children}
    </PageActionContext.Provider>
  );
}

/**
 * Hook for layout/header components to consume active page actions.
 */
export function usePageActions(): PageActionContextValue {
  return useContext(PageActionContext);
}

/**
 * Hook for client pages to register their actions with automatic lifecycle unregistration.
 */
export function useRegisterPageActions(actions: PageActions | null) {
  const { registerActions } = usePageActions();

  useEffect(() => {
    if (!actions) return;
    const unregister = registerActions(actions);
    return unregister;
  }, [registerActions, actions]);
}
