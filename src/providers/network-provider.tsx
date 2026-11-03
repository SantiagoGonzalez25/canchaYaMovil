import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface NetworkContextValue {
  /** true si hay red y el sistema no la marca como inalcanzable. */
  isOnline: boolean;
  /** false hasta que NetInfo entrega el primer estado. */
  isKnown: boolean;
  refresh: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

function resolveOnline(state: NetInfoState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isKnown, setIsKnown] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(resolveOnline(state));
      setIsKnown(true);
    });
    return unsubscribe;
  }, []);

  const refresh = useCallback(async () => {
    const state = await NetInfo.fetch();
    setIsOnline(resolveOnline(state));
    setIsKnown(true);
  }, []);

  const value = useMemo(
    () => ({ isOnline, isKnown, refresh }),
    [isOnline, isKnown, refresh],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (!context) throw new Error('useNetwork debe usarse dentro de NetworkProvider');
  return context;
}
