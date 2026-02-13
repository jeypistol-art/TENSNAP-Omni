import { redirect } from "next/navigation";

export default function PaymentCancelledPage() {
    redirect("/dashboard?payment=cancelled");
}
