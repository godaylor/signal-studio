export interface AnalysisValidationDetails {
  path?: Array<string | number>;
  hint?: string;
}

export class AnalysisValidationError extends Error {
  readonly code: string;
  readonly details: AnalysisValidationDetails;

  constructor(code: string, message: string, details: AnalysisValidationDetails = {}) {
    super(message);
    this.name = 'AnalysisValidationError';
    this.code = code;
    this.details = details;
  }
}

export function throwIfAnalysisAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException('The analysis query was cancelled.', 'AbortError');
  }
}
