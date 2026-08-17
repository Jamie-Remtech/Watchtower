import { Radio } from 'lucide-react';
import { LiveEmptyState } from '../components/LiveEmptyState';
import { useTeam } from '../hooks/useTeam';

// ============================================
// COMMS & TRACKING — activates as real collaborators go to the field.
// Channels, messaging, and welfare checks are roadmap steps built on
// the positions and events pipelines.
// ============================================

export const CommsTab = () => {
  const { liveMembers } = useTeam();

  return (
    <LiveEmptyState
      icon={Radio}
      title="Comms are quiet"
      description="Channels, personnel tracking, and welfare checks activate as your team grows and goes into the field."
      facts={[
        { label: 'Team members', value: liveMembers.length },
        { label: 'Field collaborators', value: liveMembers.filter(m => m.role === 'field').length },
      ]}
      hint="Connected to Supabase · live mode"
    />
  );
};
