import { NetworkError, TimeoutNetworkError } from "../core/api";

export const serializeError = (error: any): string => {
  try {
    if (error instanceof Error) return error.message;
    if (error instanceof NetworkError) return error.toString();
    if (error instanceof TimeoutNetworkError) return error.toString();
    if (typeof error === "object" && Object.keys(error).length > 0) return JSON.stringify(error);
    if (typeof error === "string" || typeof error === "number") return error.toString();
    return "";
  } catch (error) {
    return "Unknown error";
  }
};
