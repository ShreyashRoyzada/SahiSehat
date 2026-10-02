import { join } from "node:path";

export function dataDir(): string {
  return process.env.DATA_DIR || join(process.cwd(), ".data");
}
