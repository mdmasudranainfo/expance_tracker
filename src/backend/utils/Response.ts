import { NextResponse } from "next/server";

/**
 * Base API Response Type
 */
export interface ApiResponse<T = unknown> {
  status: "success" | "error";
  code: number;
  data: T;
}

/**
 * Success Response
 */
export const successResponse = <T>(
  data: T,
  code: number = 200
) => {
  const response: ApiResponse<T> = {
    status: "success",
    code,
    data,
  };

  return NextResponse.json(response, { status: code });
};

/**
 * Error Response
 */
export const errorResponse = <T>(
  data: T,
  code: number = 500
) => {
  const response: ApiResponse<T> = {
    status: "error",
    code,
    data,
  };

  return NextResponse.json(response, { status: code });
};