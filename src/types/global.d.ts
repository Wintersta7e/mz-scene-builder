// Ambient type declarations for the renderer process.
// Picked up by jsconfig.json's `include` glob; no runtime impact.

declare global {
  interface Window {
    api: {
      isDev: boolean;
      /** IPC `invoke` with channel allowlist enforcement. */
      invoke(channel: string, ...args: unknown[]): Promise<unknown>;
      /** Fire-and-forget log forward to the main process. */
      log(level: 'debug' | 'info' | 'warn' | 'error', args: unknown[]): void;
      /** Open an external URL via Electron's shell; host-allowlisted in preload. */
      openExternal(url: string): Promise<void>;
    };
  }
}

export {};
