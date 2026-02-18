import type { HotKit } from "./HotKit";

export const defaultConnectors = [
  async (kit: HotKit) => (await import("./evm")).default()(kit),
  async (kit: HotKit) => (await import("./near")).default()(kit),
  async (kit: HotKit) => (await import("./solana")).default()(kit),
  async (kit: HotKit) => (await import("./ton")).default()(kit),
  async (kit: HotKit) => (await import("./stellar")).default()(kit),
  async (kit: HotKit) => (await import("./tron")).default()(kit),
];
