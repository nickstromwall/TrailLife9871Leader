import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireAdmin(currentPath: string) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(currentPath);
    redirect(`/admin/login?next=${next}`);
  }

  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return { user, isAdmin: !!adminRow };
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAdmin } = await requireAdmin("/admin");

  if (!isAdmin) {
    return (
      <main className="flex-1 grid place-items-center px-6 py-20 text-center">
        <div>
          <p className="text-stone-700 font-semibold mb-2">
            Signed in as {user.email}, but no admin access yet.
          </p>
          <p className="text-sm text-stone-500 mb-6 max-w-md">
            Ask an existing admin to add your user_id (
            <code className="text-stone-700">{user.id}</code>) to the{" "}
            <code>public.admins</code> table, or insert it directly from the
            Supabase Studio SQL editor while bootstrapping the first admin.
          </p>
          <form action="/auth/sign-out" method="post">
            <button className="underline text-[var(--color-tl-green-mid)]">
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <nav className="bg-stone-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link href="/admin" className="font-bold">
            Admin
          </Link>
          <Link
            href="/"
            className="text-sm text-stone-300 hover:text-white"
          >
            ← back to public site
          </Link>
        </div>
        <div className="text-xs text-stone-300 flex items-center gap-3">
          <span>{user.email}</span>
          <form action="/auth/sign-out" method="post">
            <button className="underline">Sign out</button>
          </form>
        </div>
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
