export function isErrorStatus(code: number): boolean {
  return code >= 400;
}

export function isServerError(code: number): boolean {
  return code >= 500;
}

export function isClientError(code: number): boolean {
  return code >= 400 && code < 500;
}

export function isRedirect(code: number): boolean {
  return code >= 300 && code < 400;
}
