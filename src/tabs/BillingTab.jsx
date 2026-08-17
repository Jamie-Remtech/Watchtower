import { CreditCard } from 'lucide-react';
import { LiveEmptyState } from '../components/LiveEmptyState';
import { useOrg } from '../hooks/useOrg';
import { useDevices } from '../hooks/useDevices';
import { useTeam } from '../hooks/useTeam';

// Billing runs on real usage; these figures come straight from the database.
export const BillingTab = () => {
  const { devices } = useDevices();
  const { liveMembers } = useTeam();
  const org = useOrg();

  return (
    <LiveEmptyState
      icon={CreditCard}
      title={`${org.tier ? org.tier.charAt(0).toUpperCase() + org.tier.slice(1) : ''} plan`}
      description="Billing runs on real usage. These figures come straight from your database."
      facts={[
        { label: 'Organization', value: org.name },
        { label: 'Team members', value: liveMembers.length },
        { label: 'Registered devices', value: devices.length },
        { label: 'Channels in use', value: devices.reduce((acc, d) => acc + (d.channel_cost ?? 0), 0) },
      ]}
      hint="Connected to Supabase · live mode"
    />
  );
};
