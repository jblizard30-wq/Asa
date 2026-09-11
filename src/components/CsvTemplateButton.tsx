'use client';

import React from 'react';
import { downloadCsvTemplate, type CsvTemplateKey, CSV_TEMPLATES } from '@/lib/csvTemplates';

interface CsvTemplateButtonProps {
  template: CsvTemplateKey;
  className?: string;
  label?: string;
  size?: 'sm' | 'md';
}

export function CsvTemplateButton({
  template,
  className = '',
  label,
  size = 'sm',
}: CsvTemplateButtonProps) {
  const config = CSV_TEMPLATES[template];
  const defaultLabel = label ?? `Download Template (${config.filename.endsWith('.csv') ? '.csv' : ''})`;

  return (
    <button
      type="button"
      onClick={() => downloadCsvTemplate(template)}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
      } ${className}`}
      title={`Download sample ${config.filename}`}
    >
      <svg
        className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 12 12 16.5m0 0L16.5 12M12 16.5V3"
        />
      </svg>
      <span>{defaultLabel}</span>
    </button>
  );
}
