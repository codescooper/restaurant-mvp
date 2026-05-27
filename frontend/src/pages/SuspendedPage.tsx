import { Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { StatusBlockedCard } from '../components/StatusBlockedCard';

export default function SuspendedPage() {
  const { currentRestaurant } = useAuth();
  const restoName = currentRestaurant?.name ?? 'votre restaurant';
  return (
    <StatusBlockedCard
      icon={<Lock />}
      iconBg="bg-rose-500/10"
      iconColor="text-rose-400"
      title="Restaurant suspendu"
      subtitle={`L'accès à ${restoName} est temporairement suspendu.`}
      reason={currentRestaurant?.suspendedReason ?? null}
      whatsappMessage={`Bonjour AwemA, mon restaurant "${restoName}" est suspendu, j'aimerais en discuter.`}
      emailSubject={`[Plateforme] Restaurant suspendu : ${restoName}`}
    />
  );
}
