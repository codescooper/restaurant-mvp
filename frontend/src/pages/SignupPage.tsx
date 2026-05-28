import { useEffect, useRef, useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, ChefHat, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { signupApi } from '../services/endpoints';
import { getApiError } from '../services/api';

export default function SignupPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);
  useEffect(() => { if (isAuthenticated) navigate('/dashboard', { replace: true }); }, [isAuthenticated, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName || !restaurantName) {
      setError('Tous les champs sont requis');
      return;
    }
    setError(''); setLoading(true);
    try {
      const res = await signupApi.signup({ email, password, displayName, restaurantName });
      try {
        localStorage.setItem('accessToken', res.accessToken);
        localStorage.setItem('refreshToken', res.refreshToken);
        localStorage.setItem('activeRestaurantId', String(res.memberships[0].restaurantId));
        window.location.href = '/dashboard';   // hard refresh -> AuthContext recharge tout
      } catch (storageErr) {
        setError('Impossible de sauvegarder votre session (mode privé ?). Réessayez ou utilisez un autre navigateur.');
        setLoading(false);
      }
    } catch (err) {
      setError(getApiError(err, 'Inscription impossible'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black bg-[radial-gradient(50rem_40rem_at_50%_-10%,rgba(212,175,55,0.12),transparent)] p-4">
      <div className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-[450px] p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-400/10 ring-1 ring-gold-400/25 rounded-full mb-4">
            <ChefHat className="w-9 h-9 text-gold-400" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-100">Créer un restaurant</h1>
          <p className="text-neutral-400 text-sm">Bienvenue sur Restoflow</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-4 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" /><span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-300 mb-1">Email</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 [&>svg]:w-5 [&>svg]:h-5"><Mail /></span>
              <input id="email" ref={emailRef} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" autoComplete="email"
                className="w-full pl-10 pr-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400 outline-none" />
            </div>
          </div>
          <Field icon={<Lock />} label="Mot de passe" type="password" id="password" value={password} onChange={setPassword} placeholder="Au moins 6 caractères" autoComplete="new-password" />
          <Field icon={<User />} label="Votre nom" type="text" id="name" value={displayName} onChange={setDisplayName} placeholder="Alice Dupont" autoComplete="name" />
          <Field icon={<ChefHat />} label="Nom du restaurant" type="text" id="resto" value={restaurantName} onChange={setRestaurantName} placeholder="Chez Fatou" />

          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 disabled:opacity-50 text-black font-bold py-2.5 rounded-lg transition mt-4">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            Créer mon restaurant
          </button>
        </form>

        <p className="mt-5 text-xs text-neutral-500 text-center">
          Votre restaurant entrera en mode <b>préparation</b>. Vous pourrez le configurer (menu, tables, équipe) avant que la plateforme l'active. Aucun frais.
        </p>

        <div className="mt-4 text-center text-sm">
          <Link to="/login" className="text-neutral-400 hover:text-neutral-200">← Retour à la connexion</Link>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  icon: React.ReactNode; label: string; type: string; id: string;
  value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
}
const Field = ({ icon, label, type, id, value, onChange, placeholder, autoComplete }: FieldProps) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-neutral-300 mb-1">{label}</label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 [&>svg]:w-5 [&>svg]:h-5">{icon}</span>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete}
        className="w-full pl-10 pr-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400 outline-none" />
    </div>
  </div>
);
