import { jwtVerify } from "jose";

export async function VerifyToken(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "");
    const decoded = await jwtVerify(token, secret);
    return decoded.payload;
  } catch (err) {
    if (err instanceof Error) {
        throw new Error(err.message);
    }
    throw new Error("Token verification failed");
  }
}
