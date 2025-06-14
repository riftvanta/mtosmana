'use client';

import React from 'react';

interface IndexBuildingNoticeProps {
  className?: string;
}

const IndexBuildingNotice: React.FC<IndexBuildingNoticeProps> = ({ className = '' }) => {
  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-6 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg 
            className="h-6 w-6 text-blue-600 animate-spin" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-blue-800">
            Database Optimization in Progress
          </h3>
          <div className="mt-2 text-sm text-blue-700">
            <p>
              We're optimizing the database indices to improve performance. This process typically takes 5-15 minutes.
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>You can still create new orders</li>
              <li>Limited order history is available</li>
              <li>Full functionality will return automatically once complete</li>
            </ul>
          </div>
          <div className="mt-4">
            <button
              onClick={() => window.location.reload()}
              className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded-md transition-colors"
            >
              Check Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndexBuildingNotice; 