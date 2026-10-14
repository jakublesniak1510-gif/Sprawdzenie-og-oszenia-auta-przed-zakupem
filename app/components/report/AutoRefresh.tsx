"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Odświeża dane strony (server component) co `ms` milisekund. */
export function AutoRefresh({ ms = 3000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [router, ms]);
  return null;
}
