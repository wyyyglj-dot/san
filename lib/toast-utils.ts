import { toast } from '@/components/ui/toaster';

/**
 * Semantic toast notification helpers.
 * Wraps the raw toast() function with consistent patterns.
 */
export const notify = {
  success(title: string, description?: string) {
    toast({ title, description });
  },

  error(title: string, description?: string) {
    toast({ title, description, variant: 'destructive' });
  },

  info(title: string, description?: string) {
    toast({ title, description });
  },

  /** Show a loading toast. Returns { dismiss } to close it later. */
  loading(title: string, description?: string) {
    return toast({ title, description });
  },

  /** Shorthand for "已复制" style notifications */
  copied(label = '已复制') {
    toast({ title: label });
  },

  /** Surface an ApiClientError or generic Error */
  fromError(err: unknown, fallbackTitle = '操作失败') {
    const message =
      err instanceof Error ? err.message : String(err);
    toast({ title: fallbackTitle, description: message, variant: 'destructive' });
  },
};
