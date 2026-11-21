import { resolve } from "node:path";
process.env.WRANGLER_LOG_PATH ||= resolve(".wrangler/logs");
process.env.WRANGLER_SEND_METRICS ||= "false";
