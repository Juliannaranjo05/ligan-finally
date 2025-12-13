import React, { createContext, useContext, useState } from 'react';
import RateLimitLigand from '../components/RateLimitLigand';

const RateLimitContext = createContext();

export const RateLimitProvider = ({ children }) => {
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(60);

  const handleRateLimit = (error) => {
    if (error.response?.status === 429) {
      const retryAfterHeader = error.response.headers['retry-after'];
      const retryTime = retryAfterHeader ? parseInt(retryAfterHeader) : 60;
      
      if (!isRateLimited) { // 🔥 Solo activar si no está ya activo
        setRetryAfter(retryTime);
        setIsRateLimited(true);
        console.log(`🚦 Rate limited GLOBAL. Retry after: ${retryTime} seconds`);
      }
      return true;
    }
    return false;
  };

  const hideRateLimit = () => {
    setIsRateLimited(false);
    setRetryAfter(60);
    console.log('✅ Rate limit GLOBAL desactivado');
  };

  return (
    <RateLimitContext.Provider value={{ handleRateLimit, isRateLimited }}>
      {children}
      {/* 🔥 PANTALLA GLOBAL ÚNICA */}
      {isRateLimited && (
        <RateLimitLigand
          retryIn={retryAfter}
          onClose={hideRateLimit}
        />
      )}
    </RateLimitContext.Provider>
  );
};

export const useGlobalRateLimit = () => {
  const context = useContext(RateLimitContext);
  if (!context) {
    throw new Error('useGlobalRateLimit must be used within RateLimitProvider');
  }
  return context;
};