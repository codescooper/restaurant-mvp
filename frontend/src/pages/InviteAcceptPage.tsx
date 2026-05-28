import { useEffect, useState, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Mail, Lock, User, ChefHat, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { publicInviteApi } from '../services/endpoints';
import { getApiError } from '../services/api';
import { homeForRole } from '../services/auth-helpers';

type PeekResult = Awaited<ReturnType<typeof publicInviteApi.peek>>;

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const [peek, setPeek] = useState<PeekResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    publicInviteApi.peek(token)
      .then(setPeek)
      .catch((e) => setError(getApiError(e, 'Invitation introuvable')))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !peek) return;
    if (password.length < 6) { setError('Mot de passe trop court (6 minimum)'); return; }
    if (!peek.emailExists && !displayName.trim()) { setError('Votre nom est requis'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await publicInviteApi.accept(token, { password, displayName: displayName.trim() || undefined });
      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('refreshToken', res.refreshToken);
      localStorage.setItem('activeRestaurantId', String(res.memberships.find((m) => m.restaurantId === peek.restaurantId)?.restaurantId ?? peek.restaurantId));
      window.location.href = homeForRole(peek.role);
    } catch (err) {
      setError(getApiError(err, 'Impossible d\'accepter cette invitation'));
      setSubmitting(false);
    }
  };

  if (loading) return <Screen><Loader2 className="w-8 h-8 animate-spin text-gold-400" /></Screen>;
  if (error && !peek) return <Screen><Card><Alert>{error}</Alert><Link to="/" className="text-gold-400 mt-3 inline-block">Aller à la connexion</Link></Card></Screen>;
  if (!peek) return null;

  if (peek.status !== 'pending') {
    const labels: Record<string, string> = {
      expired: 'Lien expiré', revoked: 'Invitation révoquée', accepted: 'Invitation déjà utilisée',
    };
    return <Screen><Card>
      <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
      <h1 className="text-xl font-bold text-neutral-100 mb-2">{labels[peek.status] ?? 'Invitation invalide'}</h1>
      <p className="text-neutral-400 text-sm">Demandez un nouveau lien au propriétaire de <b>{peek.restaurantName}</b>.</p>
      <Link to="/" className="text-gold-400 mt-4 inline-block">Aller à la connexion</Link>
    </Card></Screen>;
  }

  return <Screen>
    <Card>
      <div className="inline-flex items-center justify-center w-14 h-14 bg-gold-400/10 ring-1 ring-gold-400/25 rounded-full mb-3">
        <ChefHat className="w-7 h-7 text-gold-400" />
      </div>
      <h1 className="text-xl font-bold text-neutral-100">Rejoindre {peek.restaurantName}</h1>
      <p className="text-neutral-400 text-sm">Vous êtes invité·e en tant que <b className="text-neutral-200">{peek.role}</b>.</p>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={submit} className="mt-5 space-y-3">
        <Field icon={<Mail />} label="Email" type="email" id="email" value={peek.email} onChange={() => {}} readOnly />
        {peek.emailExists ? (
          <p className="text-xs text-neutral-500">Vous avez déjà un compte. Saisissez votre mot de passe pour accepter.</p>
        ) : (
          <Field icon={<User />} label="Votre nom" type="text" id="name" value={displayName} onChange={setDisplayName} placeholder="Alice Dupont" />
        )}
        <Field icon={<Lock />} label="Mot de passe" type="password" id="pwd" value={password} onChange={setPassword} placeholder={peek.emailExists ? '••••••••' : 'Au moins 6 caractères'} autoComplete={peek.emailExists ? 'current-password' : 'new-password'} />
        <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 disabled:opacity-50 text-black font-bold py-2.5 rounded-lg mt-3">
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          Accepter et rejoindre
        </button>
      </form>
    </Card>
  </Screen>;
}

const Screen = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex items-center justify-center bg-black p-4">{children}</div>
);
const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md p-8 text-center">{children}</div>
);
const Alert = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-3 text-sm">
    <AlertCircle className="w-5 h-5 flex-shrink-0" /><span>{children}</span>
  </div>
);
interface FieldP { icon: React.ReactNode; label: string; type: string; id: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean; autoComplete?: string; }
const Field = ({ icon, label, type, id, value, onChange, placeholder, readOnly, autoComplete }: FieldP) => (
  <div className="text-left">
    <label htmlFor={id} className="block text-sm font-medium text-neutral-300 mb-1">{label}</label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 [&>svg]:w-5 [&>svg]:h-5">{icon}</span>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} readOnly={readOnly} autoComplete={autoComplete}
        className="w-full pl-10 pr-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400 outline-none disabled:opacity-60" />
    </div>
  </div>
);
