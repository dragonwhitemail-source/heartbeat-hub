import { useTestRole } from "@/contexts/TestRoleContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Shield, User, Users, Code, ShoppingCart, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const roles = [
  { value: "super_admin", label: "Super Admin", icon: Crown, color: "text-red-500" },
  { value: "admin", label: "Admin", icon: Shield, color: "text-orange-500" },
  { value: "owner", label: "Team Owner", icon: Users, color: "text-blue-500" },
  { value: "team_lead", label: "Team Lead", icon: Users, color: "text-green-500" },
  { value: "buyer", label: "Buyer", icon: ShoppingCart, color: "text-purple-500" },
  { value: "tech_dev", label: "Tech Dev", icon: Code, color: "text-cyan-500" },
  { value: "user", label: "User", icon: User, color: "text-gray-500" },
] as const;

export function RoleSwitcher() {
  const { isSuperAdmin, testRole, setTestRole, isTestingRole } = useTestRole();

  if (!isSuperAdmin) return null;

  const currentRole = roles.find(r => r.value === (testRole || "super_admin"));
  const CurrentIcon = currentRole?.icon || Crown;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className={`gap-2 shadow-lg border-2 ${isTestingRole ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950' : 'border-primary'}`}
          >
            <CurrentIcon className={`h-4 w-4 ${currentRole?.color}`} />
            <span className="hidden sm:inline">{currentRole?.label}</span>
            {isTestingRole && (
              <Badge variant="secondary" className="ml-1 text-xs bg-yellow-200 text-yellow-800">
                TEST
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Перемикач ролей
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {roles.map((role) => {
            const Icon = role.icon;
            const isActive = (testRole || "super_admin") === role.value;
            return (
              <DropdownMenuItem
                key={role.value}
                onClick={() => setTestRole(role.value === "super_admin" ? null : role.value as any)}
                className={`gap-2 cursor-pointer ${isActive ? 'bg-accent' : ''}`}
              >
                <Icon className={`h-4 w-4 ${role.color}`} />
                {role.label}
                {isActive && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setTestRole(null)}
            className="gap-2 cursor-pointer text-muted-foreground"
          >
            Скинути до Super Admin
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
