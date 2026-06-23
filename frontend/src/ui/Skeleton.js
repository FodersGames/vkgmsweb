import React from 'react';

export const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-md bg-zinc-200 dark:bg-[#2a2a3c] ${className}`} />
);

export const SkeletonText = ({ lines = 1, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={`h-3 ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`}
      />
    ))}
  </div>
);

export const SkeletonRow = ({ cols = 4, className = '' }) => (
  <div className={`flex items-center gap-4 py-3 ${className}`}>
    {Array.from({ length: cols }).map((_, i) => (
      <Skeleton key={i} className="h-4 flex-1" />
    ))}
  </div>
);

export const SkeletonCard = ({ className = '' }) => (
  <div className={`bg-white dark:bg-[#151520] border border-zinc-200 dark:border-[#2a2a3c] rounded-xl p-5 ${className}`}>
    <div className="flex items-center gap-3 mb-4">
      <Skeleton className="w-9 h-9 rounded-lg" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-2.5 w-1/2" />
      </div>
    </div>
    <SkeletonText lines={2} />
  </div>
);
