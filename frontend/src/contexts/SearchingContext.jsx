// src/contexts/SearchingContext.jsx - VERSIÓN MEJORADA
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const SearchingContext = createContext();

export const useSearching = () => {
  const context = useContext(SearchingContext);
  if (!context) {
    throw new Error('useSearching debe usarse dentro de SearchingProvider');
  }
  return context;
};

export const SearchingProvider = ({ children }) => {
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [searchingUserRole, setSearchingUserRole] = useState('cliente');
  
  // Referencias para mantener estado durante navegación
  const searchingRef = useRef(false);
  const roleRef = useRef('cliente');
  const timeoutRef = useRef(null);
  const lockRef = useRef(false); // 🔥 NUEVO: Evitar múltiples stops

  const startSearching = (userRole) => {
    console.log('🔍 [CONTEXT] Iniciando búsqueda global para:', userRole);
    
    // 🔥 LIMPIAR LOCK Y TIMEOUT ANTERIOR
    lockRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setSearchingUserRole(userRole);
    setIsSearchingUser(true);
    
    // Refs para persistencia durante navegación
    searchingRef.current = true;
    roleRef.current = userRole;
    
    // Auto-stop después de 30 segundos
    timeoutRef.current = setTimeout(() => {
      console.log('⏰ [CONTEXT] Timeout de búsqueda (60s) - deteniendo automáticamente');
      stopSearching();
    }, 60000); // 🔥 CAMBIAR A 60 segundos
    
    console.log('✅ [CONTEXT] Búsqueda activada exitosamente');
  };

  const stopSearching = () => {
    // 🔥 EVITAR MÚLTIPLES STOPS SIMULTÁNEOS
    if (lockRef.current) {
      console.log('🔒 [CONTEXT] Stop ya en progreso, ignorando...');
      return;
    }
    
    lockRef.current = true;
    console.log('🛑 [CONTEXT] Deteniendo búsqueda global');
    
    setIsSearchingUser(false);
    searchingRef.current = false;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // 🔥 RELEASE LOCK DESPUÉS DE UN PEQUEÑO DELAY
    setTimeout(() => {
      lockRef.current = false;
    }, 100);
  };

  // 🔥 STOP FORZADO - SOLO PARA VIDEOCHAT
  const forceStopSearching = () => {
    console.log('🚨 [CONTEXT] FORCE STOP - Solo VideoChat puede hacer esto');
    lockRef.current = false; // Forzar release del lock
    stopSearching();
  };

  // Recuperar estado desde refs si se perdió durante navegación
  const recoverSearchingState = () => {
    if (searchingRef.current && !isSearchingUser) {
      console.log('🔄 [CONTEXT] Recuperando estado de búsqueda');
      setIsSearchingUser(true);
      setSearchingUserRole(roleRef.current);
    }
  };

  // Auto-recovery al montar
  useEffect(() => {
    recoverSearchingState();
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <SearchingContext.Provider value={{
      isSearchingUser,
      searchingUserRole,
      startSearching,
      stopSearching,
      forceStopSearching, // 🔥 NUEVO: Para VideoChat
      recoverSearchingState,
    }}>
      {children}
    </SearchingContext.Provider>
  );
};