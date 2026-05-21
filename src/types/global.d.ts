// Ambient type declarations for the renderer process.
// Picked up by jsconfig.json's `include` glob; no runtime impact.

declare global {
  interface Window {
    api: {
      isDev: boolean;
      /** IPC `invoke` with channel allowlist enforcement. */
      invoke(channel: string, ...args: unknown[]): Promise<any>;
      /** Fire-and-forget log forward to the main process. */
      log(level: 'debug' | 'info' | 'warn' | 'error', args: unknown[]): void;
      /** Open an external URL via Electron's shell; host-allowlisted in preload. */
      openExternal(url: string): Promise<void>;
    };
  }

  /**
   * A timeline event in the scene. The set of fields varies by `type`;
   * this is a loose interface that admits every kind, with optional
   * fields keyed by the type-specific JSON shape RPG Maker emits.
   */
  interface TimelineEvent {
    type: string;
    startFrame?: number;
    _insertOrder?: number;
    pictureNumber?: number;
    imageName?: string;
    origin?: number;
    positionType?: number;
    x?: number;
    y?: number;
    scaleX?: number;
    scaleY?: number;
    opacity?: number;
    blend?: number;
    duration?: number;
    easingType?: number;
    speed?: number;
    frames?: number;
    red?: number;
    green?: number;
    blue?: number;
    gray?: number;
    intensity?: number;
    text?: string;
    background?: number;
    position?: number;
    faceName?: string;
    faceIndex?: number;
    name?: string;
    [key: string]: any;
  }

  interface DraggedEvent {
    type: string;
    [key: string]: any;
  }
}

export {};
