import { OrgRole } from '@/hooks/useOrganization';

const ROLE_CONFIG: Record<OrgRole, { label: string; className: string }> = {
  owner: { label: 'Owner', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  admin: { label: 'Admin', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  member: { label: 'Membro', className: 'bg-green-500/15 text-green-400 border-green-500/30' },
  viewer: { label: 'Observador', className: 'bg-muted text-muted-foreground border-border' },
};

export default function RoleBadge({ role }: { role: OrgRole }) {
  const config = ROLE_CONFIG[role];
  if (!config) return null;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide border ${config.className}`}>
      {config.label}
    </span>
  );
}

export { ROLE_CONFIG };
export type { OrgRole };