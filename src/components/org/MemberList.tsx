import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Trash2, MoreHorizontal, Shield, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { MemberService } from '@/services/memberService';
import { InvitationService } from '@/services/invitationService';
import type { MemberWithProfile } from '@/services/memberService';
import type { OrgRole } from '@/hooks/useOrganization';
import RoleBadge from './RoleBadge';
import InviteModal from './InviteModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

function getInitials(name: string | null, email: string): string {
  const source = (name && name.trim()) || email;
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function MemberList() {
  const { user, orgRole, hasOrgRoleMin, refreshOrg } = useAuth();
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<MemberWithProfile | null>(null);
  const [transferTarget, setTransferTarget] = useState<MemberWithProfile | null>(null);

  const canManage = hasOrgRoleMin('admin');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [memberList, inviteList] = await Promise.all([
        MemberService.getMembers(),
        canManage ? InvitationService.getPendingInvitations() : Promise.resolve([]),
      ]);
      setMembers(memberList);
      setInvitations(inviteList);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleChangeRole = async (memberId: string, newRole: OrgRole) => {
    try {
      await MemberService.changeRole(memberId, newRole);
      toast.success('Role actualizado');
      fetchData();
      refreshOrg();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar role');
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      await MemberService.removeMember(removeTarget.id);
      toast.success(`${removeTarget.profileNome || 'Membro'} removido`);
      setRemoveTarget(null);
      fetchData();
      refreshOrg();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover membro');
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await InvitationService.cancel(inviteId);
      toast.success('Convite cancelado');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cancelar convite');
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      await InvitationService.resend(inviteId);
      toast.success('Convite reenviado (validade renovada por 7 dias)');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao reenviar convite');
    }
  };

  const handleTransferOwnership = async () => {
    if (!transferTarget) return;
    try {
      await MemberService.transferOwnership(transferTarget.id);
      toast.success(`Ownership transferido para ${transferTarget.profileNome || 'membro'}`);
      setTransferTarget(null);
      fetchData();
      refreshOrg();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao transferir ownership');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Invite */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Equipa</h3>
          <p className="text-sm text-muted-foreground">{members.length} membro{members.length !== 1 ? 's' : ''}</p>
        </div>
        {canManage && <InviteModal onInvited={fetchData} />}
      </div>

      {/* Members list */}
      <Card>
        <CardContent className="p-0">
          {members.map((member, i) => {
            const isSelf = member.user_id === user?.id;
            const isOwner = member.role === 'owner';

            return (
              <div key={member.id}>
                <div className="flex items-center gap-4 px-4 py-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-primary/15 text-primary text-sm font-semibold">
                      {getInitials(member.profileNome, member.profileEmail)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {member.profileNome || 'Sem nome'}
                      </span>
                      {isSelf && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">voce</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{member.profileEmail}</p>
                  </div>

                  {canManage && !isOwner ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Alterar Role</div>
                        {(['admin', 'member', 'viewer'] as OrgRole[]).map((r) => (
                          <DropdownMenuItem
                            key={r}
                            onClick={() => handleChangeRole(member.id, r)}
                            className={member.role === r ? 'bg-accent' : ''}
                          >
                            {r === 'admin' ? 'Admin' : r === 'member' ? 'Membro' : 'Observador'}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        {orgRole === 'owner' && (
                          <DropdownMenuItem onClick={() => setTransferTarget(member)}>
                            <Shield className="mr-2 h-4 w-4" />
                            Transferir Ownership
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setRemoveTarget(member)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <RoleBadge role={member.role as any} />
                  )}
                </div>
                {i < members.length - 1 && <Separator />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {canManage && invitations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3">Convites Pendentes ({invitations.length})</h4>
          <Card>
            <CardContent className="p-0">
              {invitations.map((inv, i) => (
                <div key={inv.id}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{inv.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <RoleBadge role={inv.role} />
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(inv.expires_at).toLocaleDateString('pt-MZ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResendInvite(inv.id)}
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Reenviar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleCancelInvite(inv.id)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                  {i < invitations.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Remove confirmation dialog */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja remover <strong>{removeTarget?.profileNome || 'este membro'}</strong>?
              O utilizador perdera acesso a todos os dados da organizacao.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer ownership confirmation dialog */}
      <AlertDialog open={!!transferTarget} onOpenChange={(open) => !open && setTransferTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transferir Ownership</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja transferir a propriedade para <strong>{transferTarget?.profileNome || 'este membro'}</strong>?
              Voce passara a ser Admin. Esta accao nao pode ser desfeita pelo novo owner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransferOwnership}>
              Transferir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}