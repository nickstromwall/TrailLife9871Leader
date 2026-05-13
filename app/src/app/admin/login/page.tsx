import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="flex-1 grid place-items-center px-6 py-20">
      <div className="max-w-sm w-full bg-white border border-stone-200 rounded-2xl p-6">
        <h1 className="text-xl font-bold mb-1">Admin sign in</h1>
        <p className="text-sm text-stone-600 mb-5">
          We&apos;ll email you a one-time link. No password to remember.
        </p>
        <LoginForm next={next ?? "/admin"} />
      </div>
    </main>
  );
}
