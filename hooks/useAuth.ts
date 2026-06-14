"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getUserRole, type UserRole } from "@/lib/roles";

export interface UseAuthResult {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

/** Client-side hook exposing the current auth state, role, and sign-out. */
export function useAuth(): UseAuthResult {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const role = getUserRole(user);

  return {
    user,
    session,
    role,
    loading,
    isAuthenticated: !!user,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
}

export default useAuth;
