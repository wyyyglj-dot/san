const SCHEMA_REGISTRY: Record<string, object> = {
  asset_analyze: {
    type: 'object',
    properties: {
      characters: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            attributes: { type: 'object', additionalProperties: true },
            sourceText: { type: 'string' },
            confidence: { type: 'number' },
          },
          required: ['name'],
        },
      },
      scenes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            attributes: { type: 'object', additionalProperties: true },
            sourceText: { type: 'string' },
            confidence: { type: 'number' },
          },
          required: ['name'],
        },
      },
      props: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            attributes: { type: 'object', additionalProperties: true },
            sourceText: { type: 'string' },
            confidence: { type: 'number' },
          },
          required: ['name'],
        },
      },
    },
    required: ['characters', 'scenes', 'props'],
  },
  storyboard: {
    type: 'object',
    properties: {
      shots: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'number' },
            description: { type: 'string' },
            prompt: { type: 'string' },
            durationSeconds: { type: 'number' },
          },
          required: ['index', 'description', 'prompt'],
        },
      },
    },
    required: ['shots'],
  },
};

export function getSchemaForFeature(featureKey: string): object | null {
  return SCHEMA_REGISTRY[featureKey] ?? null;
}
