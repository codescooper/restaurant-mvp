import { FlaskConical } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function SimulationBanner() {
  const { currentRestaurant, currentRole } = useAuth();
  if (currentRestaurant?.status !== 'pending') return null;
  if (currentRole !== 'propriétaire') return null;
  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-2 flex items-center gap-2 text-sm">
      <FlaskConical className="w-4 h-4 flex-shrink-0" />
      <span><b>Mode préparation</b> — les commandes test, sessions de caisse et mouvements de stock seront effacés à l'activation. Les stocks seront restaurés à leurs valeurs préparées.</span>
    </div>
  );
}
