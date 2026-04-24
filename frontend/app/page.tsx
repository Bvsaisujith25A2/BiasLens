"use client";

import { useAuth } from "@/contexts/auth-context";
import { HomeLanding } from "@/components/home-landing";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && user) {
      router.replace("/dashboard");
    }
  }, [mounted, user, router]);

  if (!mounted) {
    return null;
  }

  return <HomeLanding />;
}
