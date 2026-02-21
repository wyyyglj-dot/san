import { describe, it, expect } from 'vitest';
import { getSchemaForFeature } from '../schema-registry';

describe('getSchemaForFeature', () => {
  it('returns schema for known key "asset_analyze"', () => {
    const schema = getSchemaForFeature('asset_analyze');
    expect(schema).not.toBeNull();
    expect(schema).toHaveProperty('type', 'object');
  });

  it('returns schema for known key "storyboard"', () => {
    const schema = getSchemaForFeature('storyboard');
    expect(schema).not.toBeNull();
    expect(schema).toHaveProperty('type', 'object');
  });

  it('returns null for unknown key', () => {
    expect(getSchemaForFeature('nonexistent')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getSchemaForFeature('')).toBeNull();
  });
});
