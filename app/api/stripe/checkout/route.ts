import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/db";
import { getTenantId } from "@/lib/tenant";
import Stripe from "stripe";

const DEFAULT_PRODUCT_IDS = {
    setup: "prod_Tv7PUAuavY1I1s",
    monthly: "prod_Tv7RHfcj9WrCP5",
};

async function resolvePriceId(options: {
    explicitPriceId?: string;
    productId?: string;
    type: "one_time" | "recurring";
    label: string;
}) {
    if (options.explicitPriceId) {
        try {
            const price = await stripe.prices.retrieve(options.explicitPriceId);
            if (!price || price.deleted) {
                throw new Error(`${options.label} explicit price is deleted`);
            }
            if (price.type !== options.type) {
                throw new Error(
                    `${options.label} explicit price type mismatch: expected ${options.type}, got ${price.type}`
                );
            }
            return price.id;
        } catch (err) {
            if (!isPriceMissingError(err)) {
                throw err;
            }
            console.warn(
                `[stripe] ${options.label} explicit price not found: ${options.explicitPriceId}. Fallback to product lookup.`
            );
        }
    }

    if (!options.productId) {
        throw new Error(`${options.label} product id is not configured`);
    }

    const prices = await stripe.prices.list({
        product: options.productId,
        active: true,
        limit: 1,
        type: options.type,
    });

    if (prices.data.length === 0) {
        throw new Error(
            `${options.label} price not found for product ${options.productId} in current Stripe mode`
        );
    }

    return prices.data[0].id;
}

function isCouponMissingError(err: unknown) {
    const stripeErr = err as { type?: string; code?: string; message?: string };
    const message = String(stripeErr?.message || "");
    return (
        stripeErr?.type === "StripeInvalidRequestError" &&
        (stripeErr?.code === "resource_missing" || message.includes("No such coupon"))
    );
}

function isPriceMissingError(err: unknown) {
    const stripeErr = err as { type?: string; code?: string; message?: string };
    const message = String(stripeErr?.message || "");
    return (
        stripeErr?.type === "StripeInvalidRequestError" &&
        (stripeErr?.code === "resource_missing" || message.includes("No such price"))
    );
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
}

export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Resolve Organization
        const orgId = await getTenantId(session.user.id, session.user.email);

        // 2. Fetch Organization Details (for Created At check)
        const orgRes = await query<{ created_at: Date, stripe_customer_id: string }>(
            `SELECT created_at, stripe_customer_id FROM organizations WHERE id = $1`,
            [orgId]
        );
        const org = orgRes.rows[0];
        if (!org) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        // 3. Early Bird Check (7 Days)
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const isEarlyBird = (new Date().getTime() - new Date(org.created_at).getTime()) < ONE_WEEK_MS;

        // 4. Resolve Prices
        // Prefer explicit price IDs in env for live/test separation.
        const monthlyPriceId = await resolvePriceId({
            explicitPriceId: process.env.STRIPE_MONTHLY_PRICE_ID,
            productId: process.env.STRIPE_MONTHLY_PRODUCT_ID || DEFAULT_PRODUCT_IDS.monthly,
            type: "recurring",
            label: "Monthly",
        });
        const setupPriceId = await resolvePriceId({
            explicitPriceId: process.env.STRIPE_SETUP_PRICE_ID,
            productId: process.env.STRIPE_SETUP_PRODUCT_ID || DEFAULT_PRODUCT_IDS.setup,
            type: "one_time",
            label: "Setup",
        });

        // 5. Construct Checkout Params
        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const successUrl = process.env.STRIPE_SUCCESS_URL || `${baseUrl}/?payment=success`;
        const cancelUrl = process.env.STRIPE_CANCEL_URL || `${baseUrl}/?payment=cancelled`;
        const earlyBirdCoupon = process.env.STRIPE_EARLY_BIRD_COUPON_ID || "EARLY_BIRD_50";

        const checkoutParams: Stripe.Checkout.SessionCreateParams = {
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [
                { price: setupPriceId, quantity: 1 },
                { price: monthlyPriceId, quantity: 1 },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                organization_id: orgId,
                user_id: session.user.id,
            },
            customer_email: session.user.email || undefined,
            client_reference_id: orgId,
        };

        // Reuse Customer if exists
        if (org.stripe_customer_id) {
            checkoutParams.customer = org.stripe_customer_id;
            delete checkoutParams.customer_email; // Cannot set both
        }

        // 6. Apply Early Bird Discount (Initial Fee 50% OFF)
        if (isEarlyBird) {
            checkoutParams.discounts = [{ coupon: earlyBirdCoupon }];
        } else {
            checkoutParams.allow_promotion_codes = true;
        }

        let checkoutSession: Stripe.Checkout.Session;
        try {
            checkoutSession = await stripe.checkout.sessions.create(checkoutParams);
        } catch (err) {
            // Coupon often differs between test/live; retry without coupon instead of 500.
            if (isEarlyBird && checkoutParams.discounts && isCouponMissingError(err)) {
                delete checkoutParams.discounts;
                checkoutParams.allow_promotion_codes = true;
                checkoutSession = await stripe.checkout.sessions.create(checkoutParams);
            } else {
                throw err;
            }
        }

        return NextResponse.json({ url: checkoutSession.url });

    } catch (error: unknown) {
        console.error("Stripe Checkout Error:", error);
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
