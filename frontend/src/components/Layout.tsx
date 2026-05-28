import { ReactNode, useMemo } from 'react';
import { Navigation } from './Navigation';
import { SimulationBanner } from './SimulationBanner';
import { useAuth } from '../contexts/AuthContext';
import { hexToRgbChannels, shade } from '../utils/color';

export function Layout({ children }: { children: ReactNode }) {
  const { branding } = useAuth();

  // Variables CSS calculées depuis le branding (scopées au conteneur du Layout,
  // pas à document.documentElement, pour que la landing garde les défauts or).
  const themeVars = useMemo(() => {
    if (!branding) return undefined;
    const primary = branding.primaryColor || '#D4AF37';
    const accent  = branding.accentColor  || '#E4C86A';
    return {
      '--gold-400':     hexToRgbChannels(primary),
      '--gold-300':     shade(primary, 0.18),
      '--gold-500':     shade(primary, -0.12),
      '--brand-accent': hexToRgbChannels(accent),
    } as React.CSSProperties;
  }, [branding?.primaryColor, branding?.accentColor]);

  // Style de fond : image si disponible, sinon backgroundColor du branding (ou noir par défaut).
  const backgroundStyle = useMemo((): React.CSSProperties => {
    if (branding?.backgroundUrl) {
      return {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.92)), url(${branding.backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundAttachment: 'fixed',
        backgroundPosition: 'center',
      };
    }
    return {
      backgroundColor: branding?.backgroundColor || '#000000',
    };
  }, [branding?.backgroundUrl, branding?.backgroundColor]);

  return (
    <div
      className="min-h-screen"
      style={{ ...themeVars, ...backgroundStyle }}
    >
      <Navigation />
      <SimulationBanner />
      <main>{children}</main>
    </div>
  );
}
