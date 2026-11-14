import useAuth from "@/utils/useAuth";

export default function LogoutPage() {
  const { signOut } = useAuth();
  const handleSignOut = async () => {
    await signOut({
      callbackUrl: "/",
      redirect: true,
    });
  };
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#FFFDF9] p-4">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 text-center shadow-xs">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-[#4A0A0F]">
          Sign Out
        </h1>
        <p className="mb-8 text-sm text-stone-600">
          Are you sure you want to sign out?
        </p>

        <button
          onClick={handleSignOut}
          className="w-full rounded-xl bg-[#4A0A0F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#360509] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A0A0F] focus-visible:ring-offset-2"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
