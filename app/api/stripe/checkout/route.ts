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
        return options.explicitPriceId;
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

function isCouponNotApplicableError(err: unknown) {
    const stripeErr = err as { type?: string; message?: string };
    const message = String(stripeErr?.message || "");
    return (
        stripeErr?.type === "StripeInvalidRequestError" &&
        message.includes("cannot be redeemed because it does not apply to anything in this order")
    );
}

function isPromotionCodeMissingError(err: unknown) {
    const stripeErr = err as { type?: string; code?: string; message?: string };
    const message = String(stripeErr?.message || "");
    return (
        stripeErr?.type === "StripeInvalidRequestError" &&
        (stripeErr?.code === "resource_missing" || message.includes("No such promotion code"))
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

function isStripeInvalidRequestError(err: unknown) {
    const stripeErr = err as { type?: string };
    return stripeErr?.type === "StripeInvalidRequestError";
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
        const orgRes = await query<{
            created_at: Date | string;
            trial_ends_at: Date | string | null;
            subscription_status: string | null;
            stripe_customer_id: string;
        }>(
            `SELECT created_at, trial_ends_at, subscription_status, stripe_customer_id FROM organizations WHERE id = $1`,
            [orgId]
        );
        const org = orgRes.rows[0];
        if (!org) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        // 3. Early Bird Check (7 Days)
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const nowMs = Date.now();
        const createdAtMs = new Date(org.created_at).getTime();
        const trialEndsAtMs = org.trial_ends_at ? new Date(org.trial_ends_at).getTime() : NaN;
        const isTrialing = org.subscription_status === "trialing" || org.subscription_status === "trial";
        const isWithinCreatedWindow =
            Number.isFinite(createdAtMs) && (nowMs - createdAtMs) >= 0 && (nowMs - createdAtMs) < ONE_WEEK_MS;
        const isWithinTrialWindow =
            isTrialing && Number.isFinite(trialEndsAtMs) && (trialEndsAtMs - nowMs) > ONE_WEEK_MS;
        const isEarlyBird = isWithinCreatedWindow || isWithinTrialWindow;

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
        const earlyBirdPromotionCode = process.env.STRIPE_EARLY_BIRD_PROMOTION_CODE_ID;
        console.log("Checkout early-bird evaluation", {
            orgId,
            created_at: String(org.created_at),
            trial_ends_at: org.trial_ends_at ? String(org.trial_ends_at) : null,
            subscription_status: org.subscription_status || null,
            isWithinCreatedWindow,
            isWithinTrialWindow,
            isEarlyBird,
            earlyBirdCoupon,
            earlyBirdPromotionCode: earlyBirdPromotionCode || null,
        });

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
            checkoutParams.discounts = earlyBirdPromotionCode
                ? [{ promotion_code: earlyBirdPromotionCode }]
                : [{ coupon: earlyBirdCoupon }];
        } else {
            checkoutParams.allow_promotion_codes = true;
        }

        let checkoutSession: Stripe.Checkout.Session;
        try {
            checkoutSession = await stripe.checkout.sessions.create(checkoutParams);
        } catch (err) {
            if (isPriceMissingError(err)) {
                // Explicit STRIPE_*_PRICE_ID may point to another mode/account; fallback to product lookup.
                const fallbackMonthlyPriceId = await resolvePriceId({
                    productId: process.env.STRIPE_MONTHLY_PRODUCT_ID || DEFAULT_PRODUCT_IDS.monthly,
                    type: "recurring",
                    label: "Monthly",
                });
                const fallbackSetupPriceId = await resolvePriceId({
                    productId: process.env.STRIPE_SETUP_PRODUCT_ID || DEFAULT_PRODUCT_IDS.setup,
                    type: "one_time",
                    label: "Setup",
                });
                checkoutParams.line_items = [
                    { price: fallbackSetupPriceId, quantity: 1 },
                    { price: fallbackMonthlyPriceId, quantity: 1 },
                ];
                checkoutSession = await stripe.checkout.sessions.create(checkoutParams);
            } else if (
                isEarlyBird &&
                checkoutParams.discounts &&
                (
                    isCouponMissingError(err) ||
                    isPromotionCodeMissingError(err) ||
                    isCouponNotApplicableError(err) ||
                    isStripeInvalidRequestError(err)
                )
            ) {
                console.error(
                    "Early-bird discount could not be applied. Retrying checkout without discount.",
                    {
                        orgId,
                        earlyBirdCoupon,
                        earlyBirdPromotionCode,
                        error: getErrorMessage(err),
                    }
                );
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
