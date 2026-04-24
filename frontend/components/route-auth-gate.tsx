"use client";

import { useAuth } from "@/contexts/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo } from "react";

const PUBLIC_PATHS = ["/", "/about", "/basic", "/login", "/register"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function RouteAuthGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const publicRoute = useMemo(() => isPublicPath(pathname), [pathname]);

  useEffect(() => {
    if (isLoading || publicRoute || user) {
      return;
    }

    const next = encodeURIComponent(pathname);
    router.replace(`/login?next=${next}`);
  }, [isLoading, publicRoute, user, pathname, router]);

  if (isLoading && !publicRoute) {
    return <div className="p-6 text-sm text-muted-foreground">Checking authentication...</div>;
  }

  if (!publicRoute && !user) {
    return null;
  }

  return <>{children}</>;
}