import { api } from "./api";
import { HotConnector } from "../HotConnector";
import { formatter } from "./utils";

export interface ILogger {
  log: (message: string) => void;
}

export class Telemetry {
  events: { event: string; value_str?: string; value_float?: number; ts: number }[] = [];
  constructor(readonly wibe3: HotConnector) {
    this.flush();
  }

  async flush() {
    await formatter.wait(5000);

    if (this.events.length > 0) {
      await api
        .publishTelemetry(this.events, this.wibe3.priorityWallet?.address ?? "")
        .then(() => (this.events = []))
        .catch(() => {});
    }

    await this.flush();
  }

  log(event: string, value: string | number) {
    if (typeof value === "string") this.events.push({ event, value_str: value, ts: Date.now() });
    else this.events.push({ event, value_float: value, ts: Date.now() });
  }
}
