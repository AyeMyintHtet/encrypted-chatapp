import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Valid deletion grace periods in days */
const VALID_PERIODS = new Set([7, 30, 90]);

/**
 * POST /api/account/delete
 * Schedules or cancels account deletion for the authenticated user.
 *
 * Body: { action: "schedule", period_days: 7 | 30 | 90 }
 *   or  { action: "cancel" }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      action: "schedule" | "cancel";
      period_days?: number;
    };

    // --- Cancel deletion ---
    if (body.action === "cancel") {
      const { error } = await supabase
        .from("profiles")
        .update({
          deletion_scheduled_at: null,
          deletion_period_days: null,
        })
        .eq("id", user.id);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: "Deletion cancelled." });
    }

    // --- Schedule deletion ---
    if (body.action === "schedule") {
      const periodDays = body.period_days;

      if (!periodDays || !VALID_PERIODS.has(periodDays)) {
        return NextResponse.json(
          { error: "Invalid period. Must be 7, 30, or 90 days." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          deletion_scheduled_at: new Date().toISOString(),
          deletion_period_days: periodDays,
        })
        .eq("id", user.id);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Account scheduled for deletion in ${periodDays} days.`,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'schedule' or 'cancel'." },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[account/delete] Internal error:", message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
