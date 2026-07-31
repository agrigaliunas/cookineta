import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types";

/**
 * Cliente para Server Components, Server Actions y Route Handlers.
 *
 * Va atado a las cookies de sesión, así que las policies de RLS se aplican con
 * la identidad real de quien navega: anónimo en la vitrina, administradora en
 * /admin. Por eso no hace falta la service-role key en ningún lado.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Los Server Components no pueden escribir cookies. El refresh de
            // sesión lo hace el middleware, así que ignorar acá es correcto.
          }
        },
      },
    },
  );
}
