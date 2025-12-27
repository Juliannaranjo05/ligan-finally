import { useEffect, useState, useCallback } from 'react';
import { getUser, refreshUser } from '../../utils/auth';

// Estado global simple para compartir el usuario entre componentes
let globalUser = null;
let globalLoading = false;
let globalError = null;
const listeners = new Set();

const notifyListeners = () => {
  for (const listener of listeners) {
    listener({ user: globalUser, loading: globalLoading, error: globalError });
  }
};

const loadUser = async (forceRefresh = false) => {
  if (globalLoading && !forceRefresh) return;

  globalLoading = true;
  notifyListeners();

  try {
    const data = forceRefresh ? await refreshUser() : await getUser();
    // getUser puede devolver { user: {...} } o el user directo
    const user = data?.user || data;
    globalUser = user;
    globalError = null;
  } catch (error) {
    globalError = error;
  } finally {
    globalLoading = false;
    notifyListeners();
  }
};

export const useCurrentUser = () => {
  const [state, setState] = useState({
    user: globalUser,
    loading: globalLoading || !globalUser,
    error: globalError
  });

  useEffect(() => {
    const listener = (nextState) => setState(nextState);
    listeners.add(listener);

    // Primera carga si aún no hay usuario
    if (!globalUser && !globalLoading) {
      loadUser(false);
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(async () => {
    await loadUser(true);
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    refresh
  };
};

export default useCurrentUser;

