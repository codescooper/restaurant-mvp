import { Hourglass } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { StatusBlockedCard } from '../components/StatusBlockedCard';

export default function PendingMemberPage() {
  const { currentRestaurant } = useAuth();
  const restoName = currentRestaurant?.name ?? 'votre restaurant';
  return (
    <StatusBlockedCard
      icon={<Hourglass />}
      iconBg="bg-amber-500/10"
      iconColor="text-amber-400"
      title="Restaurant en préparation"
      subtitle={`${restoName} n'est pas encore activé. Contactez le propriétaire ou patientez.`}
      whatsappMessage={`Bonjour AwemA, je suis membre de "${restoName}" qui n'est pas encore activé.`}
      emailSubject={`[Plateforme] Restaurant en préparation : ${restoName}`}
    />
  );
}
