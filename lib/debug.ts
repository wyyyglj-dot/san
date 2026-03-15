export type DebugInfo = {
  apiUrl: string | null;
  model: string | null;
  channelId: string | null;
  channelType: string | null;
  provider: string | null;
  modelId: string | null;
  requestId: string | null;
};

export function buildDebugInfo(input: Partial<DebugInfo>): DebugInfo {
  return {
    apiUrl: input.apiUrl ?? null,
    model: input.model ?? null,
    channelId: input.channelId ?? null,
    channelType: input.channelType ?? null,
    provider: input.provider ?? null,
    modelId: input.modelId ?? null,
    requestId: input.requestId ?? null,
  };
}

export function attachDebugInfo<T extends Record<string, unknown>>(
  payload: T,
  debug: DebugInfo,
  isAdmin: boolean
): T & { _debug?: DebugInfo } {
  if (!isAdmin) {
    return payload;
  }
  return {
    ...payload,
    _debug: debug,
  };
}
