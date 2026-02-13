import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function hasForceLogoutError(session: unknown): boolean {
  if (!session || typeof session !== "object") return false;
  const maybe = session as { error?: unknown };
  return maybe.error === "ForceLogout";
}

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session && !hasForceLogoutError(session)) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#f2f4f8] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 sm:p-10">
        <div className="mb-7">
          <div className="w-64 mx-auto mb-4">
            <img
              src="/images/logo.png"
              alt="TENsNAP・Omni"
              className="w-full h-auto object-contain"
            />
          </div>
          <p className="text-[32px] text-gray-400 text-center leading-none mb-1">.</p>
          <p className="text-center text-2xl text-gray-500 font-semibold leading-snug">
            OCR-powered automatic grading.<br />
            Stop manual entry. Start analyzing.
          </p>
        </div>

        <LoginForm />

        <p className="mt-10 text-center text-[11px] tracking-wide font-bold text-gray-300">
          POWERED BY TENSNAP・OMNI
        </p>
      </div>
    </main>
  );
}
