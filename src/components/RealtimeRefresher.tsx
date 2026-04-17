"use client";

/**
 * RealtimeRefresher — conecta ao Supabase Realtime e chama router.refresh()
 * quando a tabela configurada muda. O Next.js App Router re-executa o servidor
 * silenciosamente: dados atualizados sem recarregar a página.
 *
 * Uso dentro de qualquer Server Component:
 *   <RealtimeRefresher table="leads" />
 *   <RealtimeRefresher table="conversas" filter={`lead_id=eq.${id}`} event="INSERT" />
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  /** Nome da tabela Supabase a monitorar */
  table: string;
  /** Filtro PostgREST opcional, ex: "lead_id=eq.abc123" */
  filter?: string;
  /** Evento a escutar. Padrão: "*" (INSERT + UPDATE + DELETE) */
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  /** Throttle mínimo em ms entre refreshes. Padrão: 1000ms */
  throttleMs?: number;
}

export default function RealtimeRefresher({
  table,
  filter,
  event = "*",
  throttleMs = 1000,
}: Props) {
  const router = useRouter();
  const routerRef = useRef(router);
  const lastRefresh = useRef(0);
  routerRef.current = router;

  useEffect(() => {
    const supabase = createClient();
    const channelName = `rtr__${table}__${filter ?? "all"}__${event}`;

    const config: Record<string, string> = {
      event,
      schema: "public",
      table,
    };
    if (filter) config.filter = filter;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes" as "system", config as never, () => {
        const now = Date.now();
        if (now - lastRefresh.current < throttleMs) return; // throttle
        lastRefresh.current = now;
        routerRef.current.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, event, throttleMs]);

  return null;
}
