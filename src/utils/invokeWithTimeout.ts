import { invoke } from "@tauri-apps/api/core";

export function invokeWithTimeout<T>(
  cmd: string,
  args?: Record<string, unknown>,
  timeoutMs = 5000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  return Promise.race([
    invoke<T>(cmd, args).then((result) => {
      clearTimeout(timer);
      return result;
    }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`IPC timeout: ${cmd}`)),
        timeoutMs,
      );
    }),
  ]);
}
