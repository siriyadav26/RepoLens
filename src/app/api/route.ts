import { NextResponse } from "next/server";

// This route intentionally returns 404 to avoid advertising the API surface.
export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}