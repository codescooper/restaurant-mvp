import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Loader2, AlertCircle, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { homeForRole } from '../services/auth-helpers';
import { getApiError } from '../services/api';

export default function SelectRestaurantPage() {
  const { isAuthenticated, memberships, selectRestaurant, logout, loading, currentUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { navigate('/login', { replace: true }); return; }
    // Un super-admin n'a pas de restaurant : l'envoyer vers sa console au lieu du cul-de-sac.
    if (currentUser?.isSuperAdmin && memberships.length === 0) navigate('/super-admin', { replace: true });
  }, [loading, isAuthenticated, currentUser, memberships.length, navigate]);

  const choose = async (restaurantId: number) => {
    setError('');
    setBusy(restaurantId);
    try {
      const role = await selectRestaurant(restaurantId);
      navigate(homeForRole(role), { replace: true });
    } catch (err) {
      setError(getApiError(err, 'Sélection impossible'));
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gold-400/10 ring-1 ring-gold-400/25 rounded-full mb-3">
            <Store className="w-7 h-7 text-gold-400" />
          </div>
          <h1 className="text-xl font-bold text-neutral-100">Choisir un restaurant</h1>
          <p className="text-neutral-400 text-sm">Vous avez accès à plusieurs établissements.</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-4 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {memberships.length === 0 ? (
          <p className="text-neutral-400 text-center text-sm">
            Aucun restaurant actif. Contactez le propriétaire pour une invitation.
          </p>
        ) : (
          <div className="space-y-2">
            {memberships.map((m) => (
              <button
                key={m.restaurantId}
                disabled={busy !== null}
                onClick={() => choose(m.restaurantId)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-left transition disabled:opacity-50"
              >
                <div>
                  <div className="font-medium text-neutral-100">{m.restaurantName}</div>
                  <div className="text-xs text-neutral-400 capitalize">{m.role}</div>
                </div>
                {busy === m.restaurantId && <Loader2 className="w-5 h-5 animate-spin text-gold-400" />}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            logout();
            navigate('/', { replace: true });
          }}
          className="mt-6 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 font-medium text-sm"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
