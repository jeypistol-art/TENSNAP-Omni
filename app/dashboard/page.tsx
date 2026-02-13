import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard/Dashboard";
import AuthorizationClient from "@/app/authorization-client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function hasForceLogoutError(session: unknown): boolean {
    if (!session || typeof session !== "object") return false;
    const maybe = session as { error?: unknown };
    return maybe.error === "ForceLogout";
}

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user || hasForceLogoutError(session)) {
        redirect("/login");
    }

    return (
        <>
            <AuthorizationClient accountId={session.user.id} />
            <Dashboard />
        </>
    );
}
