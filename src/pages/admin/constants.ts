// ============================================================
// Shared constants for admin panel components
// ============================================================
import type { PlanTier } from '@/types/admin';
import type { ChartConfig } from '@/components/ui/chart';

export const planBadge: Record<PlanTier, string> = {
  free: 'bg-muted text-muted-foreground border-border',
  pro: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  business: 'bg-primary/15 text-primary border-primary/30',
};

export const dauChartConfig: ChartConfig = {
  users: { label: 'Utilizadores activos', color: 'hsl(var(--chart-1))' },
};

export const signupsChartConfig: ChartConfig = {
  total: { label: 'Total de utilizadores', color: 'hsl(var(--chart-2))' },
};

export const proposalsChartConfig: ChartConfig = {
  count: { label: 'Propostas', color: 'hsl(var(--chart-3))' },
};

export const valueChartConfig: ChartConfig = {
  value: { label: 'Valor (MT)', color: 'hsl(var(--chart-4))' },
};

export type AppRole = 'admin' | 'user';

export interface AdminUser {
  id: string;
  email: string;
  nome: string | null;
  plano: PlanTier;
  propostas_mes_count: number;
  created_at: string;
  last_seen_at: string | null;
  roles: AppRole[];
}

// ---- Formatters ----
export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function formatMZNShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Desconhecido';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Agora mesmo';
  if (mins < 60) return `Há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Há ${hours}h`;
  return `Há ${Math.floor(hours / 24)}d`;
}

export function initials(name: string | null): string {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
