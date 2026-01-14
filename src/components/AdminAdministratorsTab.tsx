import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { 
  Shield, 
  ShieldOff,
  Loader2,
  Crown,
  AlertTriangle,
  Settings,
  Copy,
  Ticket,
  UserCheck,
  UserX,
  Clock
} from "lucide-react";

interface Admin {
  user_id: string;
  display_name: string | null;
  created_at: string;
  role_created_at: string;
}

interface AdminInviteCode {
  id: string;
  code: string;
  created_at: string;
  is_active: boolean;
  used_by: string | null;
  used_at: string | null;
  used_by_name?: string | null;
}

interface PendingAdmin {
  user_id: string;
  display_name: string | null;
  invite_code: string;
  registered_at: string;
}

export const AdminAdministratorsTab = () => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [adminInviteCodes, setAdminInviteCodes] = useState<AdminInviteCode[]>([]);
  const [pendingAdmins, setPendingAdmins] = useState<PendingAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [creatingCode, setCreatingCode] = useState(false);
  
  // Remove admin dialog  
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [adminToRemove, setAdminToRemove] = useState<Admin | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch all admin roles
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: false });

    // Fetch all profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, display_name");

    const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
    
    const adminsWithProfiles: Admin[] = (adminRoles || []).map(role => ({
      user_id: role.user_id,
      display_name: profilesMap.get(role.user_id)?.display_name || null,
      created_at: profilesMap.get(role.user_id)?.display_name ? "" : "",
      role_created_at: role.created_at
    }));

    // Fetch admin invite codes
    const { data: inviteCodes } = await supabase
      .from("invite_codes")
      .select("id, code, created_at, is_active, used_by, used_at")
      .eq("is_admin_invite", true)
      .order("created_at", { ascending: false });

    // Map used_by to display names
    const inviteCodesWithNames: AdminInviteCode[] = (inviteCodes || []).map(code => ({
      ...code,
      used_by_name: code.used_by ? profilesMap.get(code.used_by)?.display_name : null
    }));

    // Find pending admins (users who used admin invite codes but aren't admins yet)
    const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);
    const usedAdminCodes = inviteCodes?.filter(c => c.used_by && !adminUserIds.has(c.used_by)) || [];
    
    const pending: PendingAdmin[] = usedAdminCodes.map(code => ({
      user_id: code.used_by!,
      display_name: profilesMap.get(code.used_by!)?.display_name || null,
      invite_code: code.code,
      registered_at: code.used_at || code.created_at
    }));

    setAdmins(adminsWithProfiles);
    setAdminInviteCodes(inviteCodesWithNames);
    setPendingAdmins(pending);
    setLoading(false);
  };

  const generateInviteCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateAdminInvite = async () => {
    if (!user) return;
    
    setCreatingCode(true);
    
    try {
      const code = generateInviteCode();
      
      const { error } = await supabase
        .from("invite_codes")
        .insert({
          code,
          created_by: user.id,
          is_admin_invite: true,
          team_id: null,
          assigned_role: null
        });

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("admin.inviteCodeCreated")
      });

      fetchData();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("admin.createInviteError"),
        variant: "destructive"
      });
    }
    
    setCreatingCode(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: t("common.copied"),
      description: code
    });
  };

  const handleApproveAdmin = async (userId: string) => {
    setVerifying(true);
    
    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "admin"
        });

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("admin.adminAdded")
      });

      fetchData();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("admin.addAdminError"),
        variant: "destructive"
      });
    }
    
    setVerifying(false);
  };

  const handleRejectAdmin = async (userId: string, inviteCode: string) => {
    setVerifying(true);
    
    try {
      // Deactivate the invite code
      await supabase
        .from("invite_codes")
        .update({ is_active: false })
        .eq("code", inviteCode);

      toast({
        title: t("common.success"),
        description: t("admin.adminRejected")
      });

      fetchData();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("errors.somethingWentWrong"),
        variant: "destructive"
      });
    }
    
    setVerifying(false);
  };

  const handleRemoveAdmin = async () => {
    if (!adminToRemove) {
      return;
    }

    setVerifying(true);

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", adminToRemove.user_id)
        .eq("role", "admin");

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("admin.adminRemoved")
      });

      setRemoveDialogOpen(false);
      setAdminToRemove(null);
      fetchData();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("admin.removeAdminError"),
        variant: "destructive"
      });
    }
    
    setVerifying(false);
  };

  const handleDeactivateCode = async (codeId: string) => {
    try {
      const { error } = await supabase
        .from("invite_codes")
        .update({ is_active: false })
        .eq("id", codeId);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("admin.codeDeactivated")
      });

      fetchData();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("errors.somethingWentWrong"),
        variant: "destructive"
      });
    }
  };

  const openRemoveDialog = (admin: Admin) => {
    setAdminToRemove(admin);
    setRemoveDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const activeInviteCodes = adminInviteCodes.filter(c => c.is_active && !c.used_by);

  return (
    <div className="space-y-6">
      <AdminPageHeader 
        icon={Settings} 
        title={t("admin.administratorsTitle")} 
        description={t("admin.administratorsDescription")} 
      />
      
      {/* Info Card */}
      <Card className="border-yellow-500/50 bg-yellow-500/10">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-500">{t("appeals.attention")}</p>
            <p className="text-sm text-muted-foreground">
              {t("admin.superAdminNote")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Shield className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{admins.length}</div>
            <div className="text-xs text-muted-foreground">{t("admin.adminsTotal")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Crown className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <div className="text-2xl font-bold">1</div>
            <div className="text-xs text-muted-foreground">{t("admin.superAdminsCount")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Ticket className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <div className="text-2xl font-bold">{activeInviteCodes.length}</div>
            <div className="text-xs text-muted-foreground">{t("admin.adminActiveInvites")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <div className="text-2xl font-bold">{pendingAdmins.length}</div>
            <div className="text-xs text-muted-foreground">{t("admin.adminPendingApproval")}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Admins */}
      {pendingAdmins.length > 0 && (
        <Card className="border-orange-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-500">
              <Clock className="h-5 w-5" />
              {t("admin.adminPendingApproval")} ({pendingAdmins.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("users.user")}</TableHead>
                  <TableHead>{t("admin.adminInviteCode")}</TableHead>
                  <TableHead>{t("admin.adminRegisteredAt")}</TableHead>
                  <TableHead className="text-right">{t("sites.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingAdmins.map(pending => (
                  <TableRow key={pending.user_id}>
                    <TableCell>
                      <span className="font-medium">{pending.display_name || t("users.noName")}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{pending.invite_code}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(pending.registered_at).toLocaleDateString("uk-UA")}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        onClick={() => handleApproveAdmin(pending.user_id)}
                        disabled={verifying}
                      >
                        <UserCheck className="h-4 w-4 mr-1" />
                        {t("admin.adminApprove")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRejectAdmin(pending.user_id, pending.invite_code)}
                        disabled={verifying}
                      >
                        <UserX className="h-4 w-4 mr-1" />
                        {t("admin.adminReject")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Admin Invite Codes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            {t("admin.adminInviteCodes")}
          </CardTitle>
          <Button onClick={handleCreateAdminInvite} disabled={creatingCode}>
            {creatingCode ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Ticket className="h-4 w-4 mr-2" />
            )}
            {t("admin.adminCreateInviteCode")}
          </Button>
        </CardHeader>
        <CardContent>
          {adminInviteCodes.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">{t("admin.noInviteCodes")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.adminCode")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("admin.adminUsedBy")}</TableHead>
                  <TableHead>{t("admin.adminCreatedAt")}</TableHead>
                  <TableHead className="text-right">{t("sites.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminInviteCodes.map(invite => (
                  <TableRow key={invite.id}>
                    <TableCell>
                      <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                        {invite.code}
                      </code>
                    </TableCell>
                    <TableCell>
                      {invite.used_by ? (
                        <Badge variant="secondary">{t("admin.adminUsed")}</Badge>
                      ) : invite.is_active ? (
                        <Badge className="bg-green-500">{t("admin.adminActive")}</Badge>
                      ) : (
                        <Badge variant="destructive">{t("admin.adminInactive")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {invite.used_by_name || (invite.used_by ? invite.used_by.slice(0, 8) + "..." : "-")}
                    </TableCell>
                    <TableCell>
                      {new Date(invite.created_at).toLocaleDateString("uk-UA")}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {!invite.used_by && invite.is_active && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyCode(invite.code)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeactivateCode(invite.id)}
                          >
                            {t("admin.adminDeactivate")}
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Current Admins Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("admin.currentAdmins")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">{t("admin.noAdmins")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("users.user")}</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>{t("admin.roleDate")}</TableHead>
                  <TableHead className="text-right">{t("sites.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map(admin => (
                  <TableRow key={admin.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{admin.display_name || t("users.noName")}</span>
                        <Badge className="bg-primary">{t("admin.roleAdmin")}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {admin.user_id.slice(0, 12)}...
                    </TableCell>
                    <TableCell>
                      {new Date(admin.role_created_at).toLocaleDateString("uk-UA")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openRemoveDialog(admin)}
                      >
                        <ShieldOff className="h-4 w-4 mr-1" />
                        {t("admin.removeAdmin")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Remove Admin Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldOff className="h-5 w-5" />
              {t("admin.removeAdmin")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.confirmRemove")} {adminToRemove?.display_name || adminToRemove?.user_id.slice(0, 8)}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setRemoveDialogOpen(false)}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRemoveAdmin} 
              disabled={verifying}
              className="flex-1"
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldOff className="h-4 w-4 mr-2" />
              )}
              {t("admin.removeAdmin")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
