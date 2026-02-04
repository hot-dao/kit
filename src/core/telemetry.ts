import { api } from "./api";
import { HotKit } from "../HotKit";
import { formatter } from "./utils";

export interface ILogger {
  log: (message: string) => void;
}

export class Telemetry {
  events: { event: string; value_str?: string; value_float?: number; ts: number }[] = [];
  constructor(readonly kit: HotKit) {
    this.flush();
  }

  async flush() {
    await formatter.wait(5000);

    if (this.events.length > 0) {
      await api
        .publishTelemetry(this.events, this.kit.priorityWallet?.address ?? "")
        .then(() => (this.events = []))
        .catch(() => {});
    }

    await this.flush();
  }

  track(event: string, obj: Record<string, string | number> = {}) {
    const ts = Date.now();

    if (Object.keys(obj).length === 0) {
      this.events.push({ event, ts });
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      const id = `${event}_${key}`;
      if (typeof value === "string") this.events.push({ event: id, value_str: value, ts });
      else this.events.push({ event: id, value_float: value, ts });
    }
  }
}
