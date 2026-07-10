declare module "video-animation-player" {
  export interface VapRuntimeConfig {
    container: unknown;
    src: string;
    config: string | Record<string, unknown>;
    fps?: number;
    width?: number;
    height?: number;
    loop: boolean;
    mute?: boolean;
    precache?: boolean;
    accurate: boolean;
    onLoadError?: (error: unknown) => void;
    onDestory?: () => void;
    [key: string]: unknown;
  }

  export interface VapRuntimePlayer {
    on?(eventName: string, callback: (...args: unknown[]) => void): VapRuntimePlayer;
    destroy(): void;
    pause(): void;
    play(options?: VapRuntimeConfig): VapRuntimePlayer;
    setTime(seconds: number): void;
  }

  export default function createVapRuntime(options?: VapRuntimeConfig): VapRuntimePlayer;
  export function canWebGL(): boolean;
}
