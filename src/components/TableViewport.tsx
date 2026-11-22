import type { ReactNode } from 'react';

interface TableViewportProps {
  label: string;
  children: ReactNode;
}

export function TableViewport({ label, children }: TableViewportProps) {
  return (
    <div className="vektor-table-viewport" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
