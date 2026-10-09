import { NextResponse } from "next/server";
import { isAccountLocked } from "@/lib/accountLockout";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  if (!email) {
    return NextResponse.json({ locked: false });
  }

  try {
    const locked = await isAccountLocked(email);
    return NextResponse.json({ locked });
  } catch {
    return NextResponse.json({ locked: false });
  }
}
