import { NextRequest, NextResponse } from "next/server";
import { VerifyToken } from "./src/backend/utils/JWTtokenHelper";

export async function middleware(req: NextRequest) {
  try {
    let token = req.cookies.get("auth_token");
    if (!token) {
      throw new Error("No token found");
    }
    let payload: any = await VerifyToken(token["value"]);

    const requestHeader = new Headers(req.headers);
    // Adapting the fields as per the user's snippet, though the schema may differ slightly
    if (payload["phone"]) requestHeader.set("phone", payload["phone"]);
    if (payload["id"]) requestHeader.set("id", payload["id"]);
    if (payload["role"]) requestHeader.set("role", payload["role"]);
    if (payload["email"]) requestHeader.set("email", payload["email"]); // Add email since it's used in login route

    return NextResponse.next({
      request: {
        headers: requestHeader,
      },
    });
  } catch (e) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      // for backend
      return NextResponse.json(
        { status: "fail", data: "Unauthorized" },
        { status: 401 }
      );
    } else {
      // for frontend
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }
}

export const config = {
  // where middleware path is defined
  matcher: ["/api/workspace/:path*", "/api/workspace", "/api/invoice/:path*"],
};
