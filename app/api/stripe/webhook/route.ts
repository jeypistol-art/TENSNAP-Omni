import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/db";
import Stripe from "stripe";

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const nextAuthUrl = process.env.NEXTAUTH_URL || "";
const ALLOWED_COUNTRY = (process.env.STRIPE_ALLOWED_COUNTRY || "JP").toUpperCase();
const isProductionRuntime =
    process.env.NODE_ENV === "production" &&
    !nextAuthUrl.includes("localhost") &&
    !nextAuthUrl.includes("127.0.0.1");

const mapSubscriptionStatus = (status: Stripe.Subscription.Status) => {
    switch (status) {
        case "active":
            return "active";
        case "trialing":
            return "trialing";
        case "past_due":
            return "past_due";
        case "canceled":
            return "canceled";
        case "unpaid":
            return "unpaid";
        case "incomplete":
        case "incomplete_expired":
        case "paused":
            return "past_due";
        default:
            return "past_due";
    }
};

async function updateOrganizationByCustomer(customerId: string, status: string) {
    await query(
        `UPDATE organizations
         SET subscription_status = $1,
             stripe_customer_id = $2,
             trial_ends_at = CASE WHEN $1 = 'active' THEN NULL ELSE trial_ends_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE stripe_customer_id = $2`,
        [status, customerId]
    );
}

async function updateOrganizationByOrgId(orgId: string, customerId: string, status: string) {
    await query(
        `UPDATE organizations
         SET subscription_status = $1,
             stripe_customer_id = $2,
             trial_ends_at = CASE WHEN $1 = 'active' THEN NULL ELSE trial_ends_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [status, customerId, orgId]
    );
}

function normalizeCountry(country?: string | null) {
    return country?.trim().toUpperCase() || null;
}

function getCheckoutSessionCountry(session: Stripe.Checkout.Session) {
    return normalizeCountry(session.customer_details?.address?.country);
}

export async function POST(request: Request) {
    const body = await request.text();
    const sig = (await headers()).get("stripe-signature");

    let event: Stripe.Event;

    try {
        if (endpointSecret && sig) {
            event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
        } else {
            if (isProductionRuntime) {
                console.error("Webhook signature verification failed: missing secret or signature in production");
                return NextResponse.json(
                    { error: "Webhook signature verification required in production" },
                    { status: 400 }
                );
            }

            // Dev-only fallback
            console.warn("⚠️  Webhook signature verification skipped (Missing Secret)");
            event = JSON.parse(body) as Stripe.Event;
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Webhook Error: ${message}`);
        return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                const orgId = session.metadata?.organization_id;
                const customerId = typeof session.customer === "string" ? session.customer : "";
                const subscriptionId = typeof session.subscription === "string" ? session.subscription : "";
                const sessionCountry = getCheckoutSessionCountry(session);

                if (!orgId || !customerId) {
                    console.warn("checkout.session.completed missing org/customer", {
                        orgId: orgId || null,
                        customerId: customerId || null,
                    });
                    break;
                }

                if (sessionCountry && sessionCountry !== ALLOWED_COUNTRY) {
                    console.error("Non-allowed country checkout detected. Canceling subscription.", {
                        orgId,
                        customerId,
                        subscriptionId: subscriptionId || null,
                        sessionCountry,
                        allowedCountry: ALLOWED_COUNTRY,
                    });
                    if (subscriptionId) {
                        await stripe.subscriptions.cancel(subscriptionId);
                    }
                    await updateOrganizationByOrgId(orgId, customerId, "canceled");
                    break;
                }

                let nextStatus = "active";
                if (subscriptionId) {
                    const sub = await stripe.subscriptions.retrieve(subscriptionId);
                    nextStatus = mapSubscriptionStatus(sub.status);
                }

                await updateOrganizationByOrgId(orgId, customerId, nextStatus);
                console.log(`✅ checkout.session.completed applied: org=${orgId} customer=${customerId} status=${nextStatus}`);
                break;
            }
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = typeof subscription.customer === "string" ? subscription.customer : "";
                if (!customerId) {
                    console.warn(`${event.type} missing customer id`);
                    break;
                }
                const nextStatus = mapSubscriptionStatus(subscription.status);
                await updateOrganizationByCustomer(customerId, nextStatus);
                console.log(`✅ ${event.type} applied: customer=${customerId} status=${nextStatus}`);
                break;
            }
            default: {
                console.log(`ℹ️ Unhandled Stripe event type: ${event.type}`);
                break;
            }
        }
    } catch (err: unknown) {
        // Return 500 so Stripe retries delivery.
        const message = err instanceof Error ? err.message : String(err);
        console.error("Webhook processing error:", { eventType: event.type, message });
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
