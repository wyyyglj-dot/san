import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock adapter
const mockExecute = vi.fn();
const mockRunTransaction = vi.fn();
const mockAdapter = {
  execute: mockExecute,
  runTransaction: mockRunTransaction,
  close: vi.fn(),
};

vi.mock('../db-connection', () => ({
  getSharedAdapter: () => mockAdapter,
}));

vi.mock('../utils', () => ({
  generateId: vi.fn(() => 'comic-id-001'),
}));

// Mock db.ts getUserById (used by some comic functions)
vi.mock('../db', () => ({
  getUserById: vi.fn(async () => ({
    id: 'u1', email: 'a@b.com', name: 'Alice', role: 'user',
  })),
  initializeDatabase: vi.fn(),
}));

vi.mock('../db-types', () => ({
  getAffectedRows: (result: any) => result?.affectedRows ?? 0,
}));

import {
  getComicProjectById,
  getComicEpisodeById,
  getProjectAssetById,
  createProjectAsset,
  softDeleteProjectAsset,
  checkProjectAccess,
} from '../db-comic';

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockResolvedValue([[], {}]);
});

// ---- getComicProjectById ----

describe('getComicProjectById', () => {
  it('returns null when no rows', async () => {
    const result = await getComicProjectById('nonexistent');
    expect(result).toBeNull();
  });

  it('maps row to ComicProject', async () => {
    const row = {
      id: 'p1',
      owner_user_id: 'u1',
      name: 'My Project',
      aspect_ratio: '16:9',
      mode: 'standard',
      copy_text: null,
      description: 'desc',
      cover_image_url: null,
      duration_seconds: 60,
      size_label: 'medium',
      last_editor_user_id: null,
      created_at: 1000,
      updated_at: 2000,
      deleted_at: null,
      deleted_by: null,
    };
    mockExecute.mockResolvedValue([[row], {}]);
    const project = await getComicProjectById('p1');
    expect(project).toBeDefined();
    expect(project!.id).toBe('p1');
    expect(project!.ownerUserId).toBe('u1');
    expect(project!.name).toBe('My Project');
  });
});

// ---- getComicEpisodeById ----

describe('getComicEpisodeById', () => {
  it('returns null when no rows', async () => {
    const result = await getComicEpisodeById('nonexistent');
    expect(result).toBeNull();
  });

  it('maps row to ComicEpisode', async () => {
    const row = {
      id: 'e1',
      project_id: 'p1',
      order_num: 1,
      title: 'Episode 1',
      content: 'content',
      note: null,
      source_type: 'manual',
      mode: 'standard',
      created_at: 1000,
      updated_at: 2000,
      deleted_at: null,
    };
    mockExecute.mockResolvedValue([[row], {}]);
    const episode = await getComicEpisodeById('e1');
    expect(episode).toBeDefined();
    expect(episode!.title).toBe('Episode 1');
    expect(episode!.orderNum).toBe(1);
  });
});

// ---- getProjectAssetById ----

describe('getProjectAssetById', () => {
  it('returns null when no rows', async () => {
    const result = await getProjectAssetById('nonexistent');
    expect(result).toBeNull();
  });
});

// ---- createProjectAsset ----

describe('createProjectAsset', () => {
  it('throws when name is empty', async () => {
    await expect(
      createProjectAsset({ projectId: 'p1', type: 'character', name: '' }),
    ).rejects.toThrow('name is required');
  });

  it('throws when name is whitespace only', async () => {
    await expect(
      createProjectAsset({ projectId: 'p1', type: 'character', name: '   ' }),
    ).rejects.toThrow('name is required');
  });

  it('creates asset with trimmed name', async () => {
    mockExecute.mockResolvedValue([[], {}]);
    const asset = await createProjectAsset({
      projectId: 'p1',
      type: 'character',
      name: '  Alice  ',
    });
    expect(asset.name).toBe('Alice');
    expect(asset.id).toBe('comic-id-001');
  });
});

// ---- softDeleteProjectAsset ----

describe('softDeleteProjectAsset', () => {
  it('returns null when asset not found', async () => {
    mockExecute.mockResolvedValue([[], {}]);
    const result = await softDeleteProjectAsset('nonexistent');
    expect(result).toBeNull();
  });
});

// ---- checkProjectAccess ----

describe('checkProjectAccess', () => {
  it('returns owner when user is project owner', async () => {
    const row = { id: 'p1', owner_user_id: 'u1' };
    mockExecute.mockResolvedValueOnce([[row], {}]); // project query
    const access = await checkProjectAccess('p1', 'u1');
    expect(access).toBe('owner');
  });

  it('returns null when project not found', async () => {
    mockExecute.mockResolvedValue([[], {}]);
    const access = await checkProjectAccess('nonexistent', 'u1');
    expect(access).toBeNull();
  });
});
