import { NextRequest, NextResponse } from "next/server";
import { VerifyToken } from "./src/backend/utils/JWTtokenHelper";

type AuthPayload = {
  phone?: string;
  id?: string;
  role?: string;
  email?: string;
};

export async function middleware(req: NextRequest) {
  try {
    const token = req.cookies.get("auth_token");
    if (!token) {
      throw new Error("No token found");
    }
    const payload = (await VerifyToken(token.value)) as AuthPayload;

    const requestHeader = new Headers(req.headers);
    if (payload.phone) requestHeader.set("phone", payload.phone);
    if (payload.id) requestHeader.set("id", payload.id);
    if (payload.role) requestHeader.set("role", payload.role);
    if (payload.email) requestHeader.set("email", payload.email);

    return NextResponse.next({
      request: {
        headers: requestHeader,
      },
    });
  } catch {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { status: "fail", data: "Unauthorized" },
        { status: 401 },
      );
    }

    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: [
    "/api/workspace/:path*",
    "/api/workspaces/:path*",
    "/api/workspace/switch/:path*",
    "/api/wallet/:path*",
    "/api/category/:path*",
    "/api/transactions/:path*",
    "/api/sync",
    "/api/overview/:path*",
    "/api/loans/:path*",
  ],
};
