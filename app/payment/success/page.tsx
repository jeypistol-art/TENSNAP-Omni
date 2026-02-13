import { redirect } from "next/navigation";

export default function PaymentSuccessPage() {
    redirect("/?payment=success");
}

