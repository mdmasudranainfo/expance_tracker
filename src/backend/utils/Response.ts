import { NextResponse } from "next/server";

/**
 * Base API Response Type
 */
export interface ApiResponse<T = unknown> {
  status: "success" | "error";
  code: number;
  data: T;
  message?: string;
}

/**
 * Success Response
 */
export const successResponse = <T>(
  data: T,
  code: number = 200,
  message?: string
) => {
  const response: ApiResponse<T> = {
    status: "success",
    message: message || "Success",
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
  code: number = 500,
  message?: string
) => {
  const response: ApiResponse<T> = {
    status: "error",
    message: message || "Error",
    code,
    data,
  };

  return NextResponse.json(response, { status: code });
};