import { useEffect, useRef, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, User, Lock, Eye, EyeOff, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import { getApiError } from '../services/api';

const HOME: Record<Role, string> = {
  administrateur: '/dashboard',
  caissier: '/caisse',
  cuisinier: '/cuisine',
  serveur: '/salle',
};

const DEMO_ACCOUNTS = [
  { label: 'Administrateur', emoji: '👨‍💼', username: 'admin', password: 'admin123' },
  { label: 'Caissier', emoji: '🧾', username: 'caisse1', password: 'caisse123' },
  { label: 'Cuisinier', emoji: '👨‍🍳', username: 'chef1', password: 'chef123' },
  { label: 'Serveur', emoji: '🧑‍🍽️', username: 'serveur1', password: 'serveur123' },
];

export default function LoginPage() {
  const { login, isAuthenticated, currentUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isAuthenticated && currentUser) navigate(HOME[currentUser.role], { replace: true });
  }, [isAuthenticated, currentUser, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const user = await login(username, password);
      navigate(HOME[user.role], { replace: true });
    } catch (err) {
      setError(getApiError(err, "Nom d'utilisateur ou mot de passe incorrect"));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black bg-[radial-gradient(50rem_40rem_at_50%_-10%,rgba(212,175,55,0.12),transparent)] p-4">
      <div className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-[450px] p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-400/10 ring-1 ring-gold-400/25 rounded-full mb-4">
            <ChefHat className="w-9 h-9 text-gold-400" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-100">Restaurant Pilote</h1>
          <p className="text-neutral-400">Connexion à l'application</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-4 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Nom d'utilisateur</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
              <input
                ref={usernameRef}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400 outline-none"
                placeholder="admin"
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400 outline-none"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 disabled:opacity-50 text-black font-bold py-2.5 rounded-lg transition"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            Se connecter
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-neutral-800">
          <p className="text-xs text-neutral-500 text-center mb-3">Comptes de démonstration</p>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.username}
                onClick={() => fillDemo(acc.username, acc.password)}
                className="w-full flex items-center gap-3 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-left text-sm transition"
              >
                <span className="text-xl">{acc.emoji}</span>
                <div>
                  <div className="font-medium text-neutral-100">{acc.label}</div>
                  <div className="text-xs text-neutral-400">
                    {acc.username} / {acc.password}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
