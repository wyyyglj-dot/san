export const API = {
  admin: {
    settings: '/api/admin/settings',
    users: '/api/admin/users',
    usersBalance: '/api/admin/users/balance',
    stats: '/api/admin/stats',
    generations: '/api/admin/generations',
    invites: '/api/admin/invites',
    redemption: '/api/admin/redemption',
    imageChannels: '/api/admin/image-channels',
    imageModels: '/api/admin/image-models',
    videoChannels: '/api/admin/video-channels',
    videoModels: '/api/admin/video-models',
    llmModels: '/api/admin/llm-models',
    artStyles: '/api/admin/art-styles',
    agents: '/api/admin/agents',
    userGroups: '/api/admin/user-groups',
  },
  chat: {
    models: '/api/chat/models',
  },
  generate: {
    image: '/api/generate/image',
    sora: '/api/generate/sora',
    soraImage: '/api/generate/sora-image',
  },
  user: {
    password: '/api/user/password',
    history: '/api/user/history',
    characterCards: '/api/user/character-cards',
  },
} as const;

export type ApiEndpoints = typeof API;
