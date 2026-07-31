import type { NextRequest } from "next/server";
import { actualizarSesion } from "@/lib/supabase/middleware";

/**
 * Refresca la sesión de Supabase en cada request y protege /admin.
 * (En Next 16 esto se llama "proxy"; era el viejo middleware.ts.)
 */
export default async function proxy(request: NextRequest) {
  return actualizarSesion(request);
}

export const config = {
  matcher: [
    /*
     * Todo menos los estáticos de Next y las imágenes: esas rutas no necesitan
     * sesión y refrescarla ahí sería puro costo.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
