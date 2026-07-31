import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";

/** Cliente para componentes del navegador (login y subida de fotos a Storage). */
export function supabaseBrowser() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
