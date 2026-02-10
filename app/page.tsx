import { getServerSession } from "next-auth";
import AuthorizationClient from "./authorization-client";
import { authOptions } from "./api/auth/[...nextauth]/route";
import Dashboard from "@/components/dashboard/Dashboard";
import LoginForm from "@/components/LoginForm";
import Image from "next/image";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const accountId = user?.id ?? "";

  if (session && user) {
    return (
      <div className="min-h-screen bg-white">
        <AuthorizationClient accountId={accountId} />
        <Dashboard />
      </div>
    );
  }

  // Premium Login Screen
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <main className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 sm:p-12 border border-white/50 flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">

        {/* Logo Section */}
        <div className="mb-8 relative w-48 h-16 sm:w-64 sm:h-20 transition-transform hover:scale-105 duration-700">
          <Image
            src="/images/logo.png"
            alt="TENsNAP"
            fill
            className="object-contain drop-shadow-sm"
            priority
          />
        </div>

        {/* Tagline */}
        <p className="text-sm font-medium text-gray-500 text-center mb-10 tracking-wide leading-relaxed">
          OCR-powered automatic grading.<br />
          <span className="text-gray-400">Stop manual entry. Start analyzing.</span>
        </p>

        {/* Login Form Container */}
        <div className="w-full">
          <LoginForm />
        </div>

        {/* Footer / Copyright */}
        <div className="mt-12 text-center">
          <p className="text-[10px] text-gray-300 font-medium tracking-widest uppercase">
            Powered by TENsNAP・Omni
          </p>
        </div>
      </main>
    </div>
  );
}
