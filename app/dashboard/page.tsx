import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard/Dashboard";
import AuthorizationClient from "@/app/authorization-client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        redirect("/login");
    }

    return (
        <>
            <AuthorizationClient accountId={session.user.id} />
            <Dashboard />
        </>
    );
}

