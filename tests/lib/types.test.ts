import { describe, it, expect } from 'vitest';
import { MODELS, MODEL_NAMES, DEFAULT_MODEL, APP_NAME, APP_VERSION } from '../../src/lib/types.js';

describe('types', () => {
  it('has all 4 models defined', () => {
    expect(MODEL_NAMES).toHaveLength(4);
    expect(MODEL_NAMES).toContain('sonar');
    expect(MODEL_NAMES).toContain('sonar-pro');
    expect(MODEL_NAMES).toContain('sonar-reasoning-pro');
    expect(MODEL_NAMES).toContain('sonar-deep-research');
  });

  it('each model has required properties', () => {
    for (const model of Object.values(MODELS)) {
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('type');
      expect(model).toHaveProperty('description');
      expect(model).toHaveProperty('pricing');
    }
  });

  it('has correct model types', () => {
    expect(MODELS.sonar.type).toBe('Search');
    expect(MODELS['sonar-pro'].type).toBe('Search');
    expect(MODELS['sonar-reasoning-pro'].type).toBe('Reasoning');
    expect(MODELS['sonar-deep-research'].type).toBe('Research');
  });

  it('has correct defaults', () => {
    expect(DEFAULT_MODEL).toBe('sonar');
    expect(APP_NAME).toBe('pplx');
    expect(APP_VERSION).toBe('1.0.0');
  });
});
