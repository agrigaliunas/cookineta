"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export type EstadoLogin = { error?: string };

export async function iniciarSesion(
  _estadoPrevio: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const volverA = String(formData.get("volverA") ?? "/admin");

  if (!email || !password) {
    return { error: "Completá el email y la contraseña." };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Sin distinguir "no existe" de "contraseña incorrecta": eso le diría a un
    // desconocido qué mails están registrados.
    return { error: "Email o contraseña incorrectos." };
  }

  revalidatePath("/", "layout");
  redirect(volverA.startsWith("/") ? volverA : "/admin");
}

export async function cerrarSesion() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
