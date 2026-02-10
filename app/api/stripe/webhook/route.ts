import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/db";
import Stripe from "stripe";

// For local testing without CLI, we might not have a webhook secret.
// In production, this IS REQUIRED.
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
    const body = await request.text();
    const sig = (await headers()).get("stripe-signature");

    let event: Stripe.Event;

    try {
        if (endpointSecret && sig) {
            event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
        } else {
            // WARNING: Insecure fallback for testing only if secret is missing
            // In production, always verify signatures
            console.warn("⚠️  Webhook signature verification skipped (Missing Secret)");
            event = JSON.parse(body) as Stripe.Event;
        }
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // Handle the event
    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        const orgId = session.metadata?.organization_id;
        const customerId = session.customer as string;

        if (orgId) {
            console.log(`✅  Payment success for Org: ${orgId}`);

            // Activate Organization
            await query(
                `UPDATE organizations 
                 SET subscription_status = 'active', 
                     stripe_customer_id = $1,
                     trial_ends_at = NULL, -- End trial? Or keep it? Usually upon payment we switch to paid.
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [customerId, orgId]
            );
        }
    }

    return NextResponse.json({ received: true });
}
