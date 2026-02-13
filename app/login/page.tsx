"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [message, setMessage] = useState("");

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  const handleEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage("メールアドレスを入力してください。");
      return;
    }

    setLoadingEmail(true);
    setMessage("");
    try {
      const result = await signIn("email", {
        email: email.trim(),
        callbackUrl: "/dashboard",
        redirect: false,
      });

      if (result?.ok) {
        setMessage("ログイン用リンクを送信しました。メールをご確認ください。");
      } else {
        setMessage("メール送信に失敗しました。時間をおいて再試行してください。");
      }
    } catch {
      setMessage("ログイン処理中にエラーが発生しました。");
    } finally {
      setLoadingEmail(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">ログイン</h1>
        <p className="text-sm text-gray-500 mb-6">
          Google またはメールリンクで安全にログインできます。
        </p>

        <button
          onClick={handleGoogle}
          disabled={loadingGoogle}
          className="w-full mb-4 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold disabled:opacity-60"
        >
          {loadingGoogle ? "遷移中..." : "Google でログイン"}
        </button>

        <div className="relative my-5">
          <div className="border-t border-gray-200" />
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white px-2 text-xs text-gray-400">
            または
          </span>
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            メールアドレス
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            autoComplete="email"
          />
          <button
            type="submit"
            disabled={loadingEmail}
            className="w-full py-3 rounded-xl bg-gray-900 hover:bg-black text-white font-bold disabled:opacity-60"
          >
            {loadingEmail ? "送信中..." : "メールリンクを送信"}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
      </div>
    </main>
  );
}
