import { PlatformService } from "./platform.interface.js";
import { LinuxPlatform } from "./linux.platform.js";
import { WindowsPlatform } from "./windows.platform.js";

let instance: PlatformService | null = null;

export function getPlatform(): PlatformService {
  if (!instance) {
    instance = process.platform === "win32"
      ? new WindowsPlatform()
      : new LinuxPlatform();
  }
  return instance;
}

export type { PlatformService };
