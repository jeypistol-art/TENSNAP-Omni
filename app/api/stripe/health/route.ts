import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Stripe from "stripe";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { stripe } from "@/lib/stripe";
import { query } from "@/lib/db";
import { getTenantId } from "@/lib/tenant";

const DEFAULT_PRODUCT_IDS = {
    setup: "prod_Tv7PUAuavY1I1s",
    monthly: "prod_Tv7RHfcj9WrCP5",
};

type IssueLevel = "error" | "warning";
type HealthIssue = {
    code: string;
    level: IssueLevel;
    message: string;
};

type PriceCheck = {
    label: "setup" | "monthly";
    ok: boolean;
    source: "explicit_price_id" | "product_lookup";
    priceId: string | null;
    productId: string | null;
    type: "one_time" | "recurring";
    currency: string | null;
    unitAmount: number | null;
    interval: string | null;
    issues: HealthIssue[];
};

function asErrorMessage(err: unknown) {
    if (err instanceof Error) return err.message;
    return String(err);
}

function isNoSuchPrice(err: unknown) {
    const stripeErr = err as { type?: string; code?: string; message?: string };
    const message = String(stripeErr?.message || "");
    return (
        stripeErr?.type === "StripeInvalidRequestError" &&
        (stripeErr?.code === "resource_missing" || message.includes("No such price"))
    );
}

function isDeletedPrice(price: Stripe.Price | Stripe.DeletedPrice): price is Stripe.DeletedPrice {
    return "deleted" in price && price.deleted === true;
}

function promotionCouponId(promo: Stripe.PromotionCode) {
    const couponRef = promo.promotion?.coupon;
    if (!couponRef) return "";
    if (typeof couponRef === "string") return couponRef;
    return couponRef.id;
}

async function resolvePrice(
    label: "setup" | "monthly",
    expectedType: "one_time" | "recurring",
    explicitPriceId: string | undefined,
    fallbackProductId: string
): Promise<PriceCheck> {
    const issues: HealthIssue[] = [];

    if (explicitPriceId) {
        try {
            const explicitPrice = await stripe.prices.retrieve(explicitPriceId);
            if (isDeletedPrice(explicitPrice)) {
                issues.push({
                    code: "EXPLICIT_PRICE_DELETED",
                    level: "error",
                    message: `${label} price (${explicitPriceId}) is deleted`,
                });
            } else if (explicitPrice.type !== expectedType) {
                issues.push({
                    code: "EXPLICIT_PRICE_TYPE_MISMATCH",
                    level: "error",
                    message: `${label} explicit price type is ${explicitPrice.type} (expected ${expectedType})`,
                });
            } else {
                return {
                    label,
                    ok: true,
                    source: "explicit_price_id",
                    priceId: explicitPrice.id,
                    productId: typeof explicitPrice.product === "string" ? explicitPrice.product : null,
                    type: explicitPrice.type,
                    currency: explicitPrice.currency || null,
                    unitAmount: explicitPrice.unit_amount ?? null,
                    interval: explicitPrice.recurring?.interval ?? null,
                    issues,
                };
            }
        } catch (err) {
            if (isNoSuchPrice(err)) {
                issues.push({
                    code: "EXPLICIT_PRICE_NOT_FOUND",
                    level: "warning",
                    message: `${label} explicit price not found: ${explicitPriceId}. Falling back to product lookup.`,
                });
            } else {
                issues.push({
                    code: "EXPLICIT_PRICE_RETRIEVE_FAILED",
                    level: "error",
                    message: `${label} explicit price check failed: ${asErrorMessage(err)}`,
                });
            }
        }
    }

    try {
        const prices = await stripe.prices.list({
            product: fallbackProductId,
            active: true,
            limit: 1,
            type: expectedType,
        });
        const fallback = prices.data[0];
        if (!fallback) {
            issues.push({
                code: "FALLBACK_PRICE_NOT_FOUND",
                level: "error",
                message: `${label} price not found by product lookup: ${fallbackProductId}`,
            });
            return {
                label,
                ok: false,
                source: "product_lookup",
                priceId: null,
                productId: fallbackProductId,
                type: expectedType,
                currency: null,
                unitAmount: null,
                interval: null,
                issues,
            };
        }
        return {
            label,
            ok: true,
            source: "product_lookup",
            priceId: fallback.id,
            productId: typeof fallback.product === "string" ? fallback.product : fallbackProductId,
            type: fallback.type,
            currency: fallback.currency || null,
            unitAmount: fallback.unit_amount ?? null,
            interval: fallback.recurring?.interval ?? null,
            issues,
        };
    } catch (err) {
        issues.push({
            code: "FALLBACK_PRICE_LOOKUP_FAILED",
            level: "error",
            message: `${label} product lookup failed: ${asErrorMessage(err)}`,
        });
        return {
            label,
            ok: false,
            source: "product_lookup",
            priceId: null,
            productId: fallbackProductId,
            type: expectedType,
            currency: null,
            unitAmount: null,
            interval: null,
            issues,
        };
    }
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const orgId = await getTenantId(session.user.id, session.user.email);
        const orgRes = await query<{
            created_at: Date | string;
            trial_ends_at: Date | string | null;
            subscription_status: string | null;
        }>(
            `SELECT created_at, trial_ends_at, subscription_status FROM organizations WHERE id = $1`,
            [orgId]
        );
        const org = orgRes.rows[0];
        if (!org) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        const nowMs = Date.now();
        const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
        const createdAtMs = new Date(org.created_at).getTime();
        const trialEndsAtMs = org.trial_ends_at ? new Date(org.trial_ends_at).getTime() : NaN;
        const isTrialing = org.subscription_status === "trialing" || org.subscription_status === "trial";
        const isWithinCreatedWindow =
            Number.isFinite(createdAtMs) && (nowMs - createdAtMs) >= 0 && (nowMs - createdAtMs) < oneWeekMs;
        const isWithinTrialWindow =
            isTrialing && Number.isFinite(trialEndsAtMs) && (trialEndsAtMs - nowMs) > oneWeekMs;
        const isEarlyBird = isWithinCreatedWindow || isWithinTrialWindow;

        const setupProductId = process.env.STRIPE_SETUP_PRODUCT_ID || DEFAULT_PRODUCT_IDS.setup;
        const monthlyProductId = process.env.STRIPE_MONTHLY_PRODUCT_ID || DEFAULT_PRODUCT_IDS.monthly;
        const setupPriceCheck = await resolvePrice(
            "setup",
            "one_time",
            process.env.STRIPE_SETUP_PRICE_ID,
            setupProductId
        );
        const monthlyPriceCheck = await resolvePrice(
            "monthly",
            "recurring",
            process.env.STRIPE_MONTHLY_PRICE_ID,
            monthlyProductId
        );

        const discountIssues: HealthIssue[] = [];
        const couponId = process.env.STRIPE_EARLY_BIRD_COUPON_ID || "EARLY_BIRD_50";
        const promotionCodeId = process.env.STRIPE_EARLY_BIRD_PROMOTION_CODE_ID;
        let couponSummary: {
            id: string;
            valid: boolean;
            percentOff: number | null;
            amountOff: number | null;
            redeemBy: number | null;
            appliesToProducts: string[];
        } | null = null;
        let promotionSummary: {
            id: string;
            active: boolean;
            couponId: string;
            expiresAt: number | null;
        } | null = null;

        try {
            const coupon = await stripe.coupons.retrieve(couponId);
            if ("deleted" in coupon && coupon.deleted) {
                discountIssues.push({
                    code: "COUPON_DELETED",
                    level: "error",
                    message: `Coupon is deleted: ${couponId}`,
                });
            } else {
                const appliesToProducts = coupon.applies_to?.products || [];
                couponSummary = {
                    id: coupon.id,
                    valid: coupon.valid,
                    percentOff: coupon.percent_off ?? null,
                    amountOff: coupon.amount_off ?? null,
                    redeemBy: coupon.redeem_by ?? null,
                    appliesToProducts,
                };
                if (!coupon.valid) {
                    discountIssues.push({
                        code: "COUPON_INVALID",
                        level: "error",
                        message: `Coupon is invalid/expired: ${coupon.id}`,
                    });
                }
                if (coupon.redeem_by && coupon.redeem_by * 1000 < nowMs) {
                    discountIssues.push({
                        code: "COUPON_EXPIRED",
                        level: "error",
                        message: `Coupon redeem_by is in the past: ${coupon.id}`,
                    });
                }
                if ((coupon.percent_off ?? 0) <= 0 && (coupon.amount_off ?? 0) <= 0) {
                    discountIssues.push({
                        code: "COUPON_NO_DISCOUNT_VALUE",
                        level: "warning",
                        message: `Coupon has no effective discount value: ${coupon.id}`,
                    });
                }
                if (appliesToProducts.length > 0) {
                    const orderProducts = [setupPriceCheck.productId, monthlyPriceCheck.productId].filter(
                        (v): v is string => Boolean(v)
                    );
                    const appliesToOrder = appliesToProducts.some((pid) => orderProducts.includes(pid));
                    if (!appliesToOrder) {
                        discountIssues.push({
                            code: "COUPON_NOT_APPLICABLE_TO_ORDER",
                            level: "error",
                            message: `Coupon applies_to products do not match checkout order products`,
                        });
                    }
                }
            }
        } catch (err) {
            discountIssues.push({
                code: "COUPON_RETRIEVE_FAILED",
                level: "error",
                message: `Coupon check failed (${couponId}): ${asErrorMessage(err)}`,
            });
        }

        if (promotionCodeId) {
            try {
                const promo = await stripe.promotionCodes.retrieve(promotionCodeId);
                if ("deleted" in promo && promo.deleted) {
                    discountIssues.push({
                        code: "PROMOTION_CODE_DELETED",
                        level: "error",
                        message: `Promotion code is deleted: ${promotionCodeId}`,
                    });
                } else {
                    const promoCouponId = promotionCouponId(promo);
                    promotionSummary = {
                        id: promo.id,
                        active: promo.active,
                        couponId: promoCouponId,
                        expiresAt: promo.expires_at ?? null,
                    };
                    if (!promo.active) {
                        discountIssues.push({
                            code: "PROMOTION_CODE_INACTIVE",
                            level: "error",
                            message: `Promotion code is inactive: ${promo.id}`,
                        });
                    }
                    if (promo.expires_at && promo.expires_at * 1000 < nowMs) {
                        discountIssues.push({
                            code: "PROMOTION_CODE_EXPIRED",
                            level: "error",
                            message: `Promotion code expires_at is in the past: ${promo.id}`,
                        });
                    }
                    if (couponSummary && promoCouponId && promoCouponId !== couponSummary.id) {
                        discountIssues.push({
                            code: "PROMOTION_COUPON_MISMATCH",
                            level: "warning",
                            message: `Promotion code coupon (${promoCouponId}) differs from STRIPE_EARLY_BIRD_COUPON_ID (${couponSummary.id})`,
                        });
                    }
                }
            } catch (err) {
                discountIssues.push({
                    code: "PROMOTION_CODE_RETRIEVE_FAILED",
                    level: "error",
                    message: `Promotion code check failed (${promotionCodeId}): ${asErrorMessage(err)}`,
                });
            }
        }

        const issues = [
            ...setupPriceCheck.issues,
            ...monthlyPriceCheck.issues,
            ...discountIssues,
        ];
        const hasError = issues.some((i) => i.level === "error");

        return NextResponse.json({
            success: !hasError,
            checkedAt: new Date().toISOString(),
            org: {
                id: orgId,
                created_at: String(org.created_at),
                trial_ends_at: org.trial_ends_at ? String(org.trial_ends_at) : null,
                subscription_status: org.subscription_status || null,
            },
            earlyBird: {
                isWithinCreatedWindow,
                isWithinTrialWindow,
                isEarlyBird,
            },
            checkout: {
                setup: setupPriceCheck,
                monthly: monthlyPriceCheck,
            },
            discount: {
                mode: promotionCodeId ? "promotion_code" : "coupon",
                couponId,
                promotionCodeId: promotionCodeId || null,
                coupon: couponSummary,
                promotionCode: promotionSummary,
            },
            issues,
        });
    } catch (error) {
        console.error("Stripe health check error:", error);
        return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 });
    }
}
