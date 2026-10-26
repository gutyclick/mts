import type { NextRequest } from "next/server";
import { ticketGET, ticketPOST } from "@/lib/support/routes";
export const GET = (r: NextRequest) => ticketGET(r, false);
export const POST = (r: NextRequest) => ticketPOST(r, false);
