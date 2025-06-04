import { UserLensCoreApi, LoggerInterface, UserLensConfig } from '../models/plugin-interfaces'; // Adjust path as needed

// Basic console logger for now
class ConsoleLogger implements LoggerInterface {
  constructor(private prefix: string = "") {}
  info(message: string) { console.log(`[INFO]${this.prefix} ${message}`); }
  warn(message: string) { console.warn(`[WARN]${this.prefix} ${message}`); }
  error(message: string) { console.error(`[ERROR]${this.prefix} ${message}`); }
}

export class UserLensCoreApiImplementation implements UserLensCoreApi {
  private globalConfig: UserLensConfig = {}; // Initialize with empty or loaded config

  constructor(initialConfig?: UserLensConfig) {
    if (initialConfig) {
      this.globalConfig = initialConfig;
    }
    // In a real scenario, globalConfig would be loaded properly
  }

  log(level: 'info' | 'warn' | 'error', message: string): void {
    console[level](`[UserLensCore] ${message}`);
  }

  getLogger(pluginId: string): LoggerInterface {
    return new ConsoleLogger(`[${pluginId}]`);
  }

  getGlobalConfig(): Readonly<UserLensConfig> {
    return this.globalConfig;
  }

  // Method to update global config if needed, e.g., after full load
  public setGlobalConfig(config: UserLensConfig): void {
      this.globalConfig = config;
  }
}