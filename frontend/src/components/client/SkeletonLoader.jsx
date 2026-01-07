import React from 'react';

/**
 * SkeletonLoader - Componente para mostrar estados de carga con skeleton screens
 */
const SkeletonLoader = ({ 
  variant = 'text', 
  width = '100%', 
  height = '1rem',
  className = '',
  count = 1,
  rounded = false
}) => {
  const baseClasses = `bg-gradient-to-r from-[#2b2d31] via-[#1f2125] to-[#2b2d31] bg-[length:200%_100%] animate-shimmer ${rounded ? 'rounded-full' : 'rounded'} ${className}`;
  
  const variants = {
    text: baseClasses,
    circular: `${baseClasses} rounded-full`,
    rectangular: baseClasses,
    avatar: `${baseClasses} rounded-full`,
    button: `${baseClasses} rounded-lg`
  };

  const style = {
    width: variant === 'circular' || variant === 'avatar' ? height : width,
    height: height,
    animation: 'shimmer 2s infinite'
  };

  if (count > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={variants[variant] || baseClasses}
            style={style}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={variants[variant] || baseClasses}
      style={style}
      aria-label="Loading..."
      role="status"
    />
  );
};

export default SkeletonLoader;

