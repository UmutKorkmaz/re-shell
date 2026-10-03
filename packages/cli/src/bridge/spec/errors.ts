/** Raised when a service spec cannot be found, parsed or is unsupported. */
export class BridgeSpecError extends Error {
  readonly code = 'BRIDGE_SPEC_ERROR';
  constructor(message: string, readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'BridgeSpecError';
  }
}
