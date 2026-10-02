import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/server/auth";
import { exportPersonData } from "@/lib/server/person";
import { audit } from "@/lib/server/db";

export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const data = { account: { email: account.email, demo: account.isDemo }, ...exportPersonData(account.id) };
  audit("system", "person.exported", null);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="sahisehat-my-data.json"`, "cache-control": "no-store" },
  });
}
