import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<
    Awaited<ReturnType<typeof cookies>>["set"]
  >[2];
};

export async function createClient() {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },

        setAll(items: CookieToSet[]) {
          try {
            items.forEach(({ name, value, options }) => {
              store.set(name, value, options);
            });
          } catch {
            // Em Server Components, a alteração de cookies pode não ser permitida.
          }
        },
      },
    }
  );
}

// Mantém compatibilidade com arquivos que usem o nome mais descritivo.
export const createSupabaseServerClient = createClient;

export async function getCurrentProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar perfil:", error.message);
    return null;
  }

  return data;
}