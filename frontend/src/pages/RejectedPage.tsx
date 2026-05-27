import { ShieldOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { StatusBlockedCard } from '../components/StatusBlockedCard';

export default function RejectedPage() {
  const { currentRestaurant } = useAuth();
  const restoName = currentRestaurant?.name ?? 'votre restaurant';
  return (
    <StatusBlockedCard
      icon={<ShieldOff />}
      iconBg="bg-orange-500/10"
      iconColor="text-orange-400"
      title="Inscription refusée"
      subtitle={`L'inscription de ${restoName} n'a pas été approuvée.`}
      reason={currentRestaurant?.rejectedReason ?? null}
      whatsappMessage={`Bonjour AwemA, l'inscription de mon restaurant "${restoName}" a été refusée, pourrions-nous en discuter ?`}
      emailSubject={`[Plateforme] Inscription refusée : ${restoName}`}
    />
  );
}
