'use client';

/**
 * Fetches a remote asset as a blob and triggers a client-side download.
 * Using fetch avoids cross-origin navigation that happens when directly linking to the asset.
 */
export async function downloadAsset(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  link.remove();
  URL.revokeObjectURL(objectUrl);
}
