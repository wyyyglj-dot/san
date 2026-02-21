// ---------------------------------------------------------------------------
// React Query key factory
// Convention: [module, resource, ...params]
// Usage:  queryKeys.projects.list()          → ['projects', 'list']
//         queryKeys.projects.detail(id)      → ['projects', 'detail', id]
//         queryKeys.admin.users.list(params) → ['admin', 'users', 'list', params]
// ---------------------------------------------------------------------------

export const queryKeys = {
  // --- Projects ---
  projects: {
    all: ['projects'] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.projects.all, 'list', params] as const,
    detail: (id: string) =>
      [...queryKeys.projects.all, 'detail', id] as const,
    members: (id: string) =>
      [...queryKeys.projects.all, 'members', id] as const,
    episodes: (id: string) =>
      [...queryKeys.projects.all, 'episodes', id] as const,
    assets: (id: string, params?: Record<string, unknown>) =>
      [...queryKeys.projects.all, 'assets', id, params] as const,
  },

  // --- Episodes ---
  episodes: {
    all: ['episodes'] as const,
    detail: (id: string) => ['episodes', 'detail', id] as const,
    storyboard: (id: string) => ['episodes', 'storyboard', id] as const,
    assets: (id: string) => ['episodes', 'assets', id] as const,
  },

  // --- Assets ---
  assets: {
    all: ['assets'] as const,
    detail: (id: string) => ['assets', 'detail', id] as const,
    imageHistory: (id: string, params?: Record<string, unknown>) =>
      ['assets', 'imageHistory', id, params] as const,
  },

  // --- User ---
  user: {
    all: ['user'] as const,
    status: () => ['user', 'status'] as const,
    history: (params?: Record<string, unknown>) =>
      ['user', 'history', params] as const,
    tasks: (params?: Record<string, unknown>) =>
      ['user', 'tasks', params] as const,
    dailyUsage: () => ['user', 'dailyUsage'] as const,
    characterCards: () => ['user', 'characterCards'] as const,
  },

  // --- Admin ---
  admin: {
    all: ['admin'] as const,
    settings: () => ['admin', 'settings'] as const,
    stats: () => ['admin', 'stats'] as const,
    users: {
      all: ['admin', 'users'] as const,
      list: (params?: Record<string, unknown>) =>
        ['admin', 'users', 'list', params] as const,
      detail: (id: string) => ['admin', 'users', 'detail', id] as const,
    },
    imageModels: () => ['admin', 'imageModels'] as const,
    imageChannels: () => ['admin', 'imageChannels'] as const,
    videoModels: () => ['admin', 'videoModels'] as const,
    videoChannels: () => ['admin', 'videoChannels'] as const,
    llmModels: () => ['admin', 'llmModels'] as const,
    agents: {
      all: ['admin', 'agents'] as const,
      detail: (key: string) => ['admin', 'agents', 'detail', key] as const,
      versions: (key: string) => ['admin', 'agents', 'versions', key] as const,
    },
    invites: () => ['admin', 'invites'] as const,
    redemption: () => ['admin', 'redemption'] as const,
    userGroups: {
      all: ['admin', 'userGroups'] as const,
      detail: (id: string) => ['admin', 'userGroups', 'detail', id] as const,
    },
    artStyles: () => ['admin', 'artStyles'] as const,
    generations: (params?: Record<string, unknown>) =>
      ['admin', 'generations', params] as const,
    featureBindings: () => ['admin', 'featureBindings'] as const,
  },

  // --- Status ---
  status: {
    pending: () => ['status', 'pending'] as const,
    video: () => ['status', 'video'] as const,
  },

  // --- Generate ---
  generate: {
    status: (id: string) => ['generate', 'status', id] as const,
  },

  // --- Config ---
  config: {
    site: () => ['config', 'site'] as const,
    imgbed: () => ['config', 'imgbed'] as const,
  },
} as const;