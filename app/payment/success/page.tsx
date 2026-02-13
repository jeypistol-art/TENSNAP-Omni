import { redirect } from "next/navigation";

export default function PaymentSuccessPage() {
    redirect("/dashboard?payment=success");
}
