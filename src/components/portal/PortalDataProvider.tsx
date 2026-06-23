"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { portalRequest, portalSupabase } from "@/lib/portal/client";
import type { PortalBootstrap } from "@/lib/portal/types";

type PortalDataState = {
  data: PortalBootstrap | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const PortalDataContext = createContext<PortalDataState | null>(null);

export function PortalDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<PortalBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const {
      data: { session },
    } = await portalSupabase.auth.getSession();

    if (!session) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await portalRequest<PortalBootstrap>("/api/portal/bootstrap");
      setData(result);
    } catch (requestError) {
      setData(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Live portal data could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ data, error, isLoading, refresh }),
    [data, error, isLoading, refresh]
  );

  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>;
}

export function usePortalData() {
  const context = useContext(PortalDataContext);
  if (!context) {
    throw new Error("usePortalData must be used within PortalDataProvider.");
  }

  return context;
}
