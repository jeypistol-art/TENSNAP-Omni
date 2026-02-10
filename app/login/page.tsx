"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <h1>Login</h1>
      <button onClick={() => signIn("google", { callbackUrl: "/" })}>
        Sign in with Google
      </button>
    </main>
  );
}
