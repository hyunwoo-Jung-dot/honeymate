"use client";

import { useAuth } from "@/hooks/useAuth";

interface AdminGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Only renders children if user is logged in (admin)
export function AdminGuard({ children, fallback }: AdminGuardProps) {
  const { isAdmin, loading } = useAuth();

  if (loading) return null;
  if (!isAdmin) return fallback ?? null;

  return <>{children}</>;
}
