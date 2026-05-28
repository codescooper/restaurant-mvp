import { ReactNode, useEffect } from 'react';
import { Navigation } from './Navigation';
import { SimulationBanner } from './SimulationBanner';
import { useAuth } from '../contexts/AuthContext';

export function Layout({ children }: { children: ReactNode }) {
  const { branding } = useAuth();

  // Applique la couleur primaire comme variable CSS globale.
  useEffect(() => {
    const color = branding?.primaryColor || '#D4AF37';
    document.documentElement.style.setProperty('--brand-primary', color);
  }, [branding?.primaryColor]);

  return (
    <div
      className="min-h-screen bg-black"
      style={branding?.backgroundUrl ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.92)), url(${branding.backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundAttachment: 'fixed',
        backgroundPosition: 'center',
      } : undefined}
    >
      <Navigation />
      <SimulationBanner />
      <main>{children}</main>
    </div>
  );
}
