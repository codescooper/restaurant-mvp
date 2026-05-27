import { ReactNode } from 'react';
import { MessageCircle, Mail, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AWEMA_CONTACT } from '../utils/contact';

interface Props {
  icon: ReactNode;
  iconBg: string;            // ex: 'bg-rose-500/10'
  iconColor: string;         // ex: 'text-rose-400'
  title: string;
  subtitle?: string;
  reason?: string | null;
  whatsappMessage: string;
  emailSubject: string;
}

export function StatusBlockedCard({ icon, iconBg, iconColor, title, subtitle, reason, whatsappMessage, emailSubject }: Props) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const doLogout = () => { logout(); navigate('/', { replace: true }); };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md p-8 text-center">
        <div className={`inline-flex items-center justify-center w-16 h-16 ${iconBg} rounded-full mb-4`}>
          <span className={`${iconColor} [&>svg]:w-8 [&>svg]:h-8`}>{icon}</span>
        </div>
        <h1 className="text-xl font-bold text-neutral-100 mb-2">{title}</h1>
        {subtitle && <p className="text-neutral-400 text-sm mb-3">{subtitle}</p>}
        {reason && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-300 mb-4 text-left">
            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Raison</div>
            {reason}
          </div>
        )}
        <p className="text-neutral-500 text-sm mb-5">Contactez AwemA pour toute question :</p>
        <div className="flex flex-col gap-2">
          <a href={AWEMA_CONTACT.whatsappUrl(whatsappMessage)} target="_blank" rel="noreferrer"
             className="flex items-center justify-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 px-4 py-2.5 rounded-lg font-medium">
            <MessageCircle className="w-4 h-4" /> WhatsApp {AWEMA_CONTACT.whatsappPhone}
          </a>
          <a href={AWEMA_CONTACT.mailtoUrl(emailSubject)}
             className="flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 px-4 py-2.5 rounded-lg font-medium">
            <Mail className="w-4 h-4" /> {AWEMA_CONTACT.email}
          </a>
        </div>
        <button onClick={doLogout} className="mt-6 text-sm text-neutral-500 hover:text-rose-400 flex items-center gap-1 mx-auto">
          <LogOut className="w-4 h-4" /> Se déconnecter
        </button>
      </div>
    </div>
  );
}
