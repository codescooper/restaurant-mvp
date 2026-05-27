import { ReactNode } from 'react';
import { Navigation } from './Navigation';
import { SimulationBanner } from './SimulationBanner';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      <SimulationBanner />
      <main>{children}</main>
    </div>
  );
}
