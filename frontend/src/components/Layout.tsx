import { ReactNode } from 'react';
import { Navigation } from './Navigation';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      <main>{children}</main>
    </div>
  );
}
