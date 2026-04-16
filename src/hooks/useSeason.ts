"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Season } from "@/types";

export function useSeason() {
  const [supabase] = useState(() => createClient());
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeason, setActiveSeason] = useState<Season | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const fetchSeasons = useCallback(async () => {
    const { data } = await supabase
      .from("seasons")
      .select("*")
      .order("start_date", { ascending: false });
    const list = data ?? [];
    setSeasons(list);
    setActiveSeason(list.find((s: Season) => s.is_active) ?? list[0] ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons]);

  return { seasons, activeSeason, setActiveSeason, loading, refetch: fetchSeasons };
}
