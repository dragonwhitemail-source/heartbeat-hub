import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type TestRole = "super_admin" | "admin" | "owner" | "team_lead" | "buyer" | "tech_dev" | "user" | null;

interface TestRoleContextType {
  isSuperAdmin: boolean;
  testRole: TestRole;
  setTestRole: (role: TestRole) => void;
  getEffectiveRole: () => TestRole;
  isTestingRole: boolean;
}

const TestRoleContext = createContext<TestRoleContextType | undefined>(undefined);

export function TestRoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [testRole, setTestRole] = useState<TestRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSuperAdmin = async () => {
      if (!user) {
        setIsSuperAdmin(false);
        setTestRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('check-super-admin');
        if (!error && data?.isSuperAdmin) {
          setIsSuperAdmin(true);
          // Restore saved test role from localStorage
          const savedRole = localStorage.getItem('testRole') as TestRole;
          if (savedRole) {
            setTestRole(savedRole);
          }
        } else {
          setIsSuperAdmin(false);
          setTestRole(null);
        }
      } catch {
        setIsSuperAdmin(false);
      }
      setLoading(false);
    };

    checkSuperAdmin();
  }, [user]);

  const handleSetTestRole = (role: TestRole) => {
    setTestRole(role);
    if (role) {
      localStorage.setItem('testRole', role);
    } else {
      localStorage.removeItem('testRole');
    }
  };

  const getEffectiveRole = (): TestRole => {
    if (!isSuperAdmin) return null;
    return testRole || "super_admin";
  };

  const isTestingRole = isSuperAdmin && testRole !== null && testRole !== "super_admin";

  if (loading) {
    return <>{children}</>;
  }

  return (
    <TestRoleContext.Provider value={{ 
      isSuperAdmin, 
      testRole, 
      setTestRole: handleSetTestRole, 
      getEffectiveRole,
      isTestingRole 
    }}>
      {children}
    </TestRoleContext.Provider>
  );
}

export function useTestRole() {
  const context = useContext(TestRoleContext);
  if (context === undefined) {
    throw new Error("useTestRole must be used within a TestRoleProvider");
  }
  return context;
}
