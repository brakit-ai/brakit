const PREFIX = "[brakit]";

export function brakitWarn(message: string): void {
  process.stderr.write(`${PREFIX} ${message}\n`);
}

export function brakitDebug(message: string): void {
  if (process.env.DEBUG_BRAKIT) {
    process.stderr.write(`${PREFIX}:debug ${message}\n`);
  }
}
