export interface Episode {
  id: string;
  projectId: string;
  orderNum: number;
  title: string;
  content: string;
  note: string | null;
  sourceType: 'manual' | 'split' | 'import';
  mode: string;
  createdAt: number;
  updatedAt: number;
}

export interface SplitPreviewItem {
  orderNum: number;
  title: string;
  content: string;
  sourceType: 'split';
}

export interface SplitRule {
  type: 'episode_heading';
  titleTemplate: string;
  startOrderNum: number;
  maxEpisodes: number;
}

export interface SplitResult {
  items: SplitPreviewItem[];
  stats: {
    total: number;
    emptySegments: number;
  };
}
