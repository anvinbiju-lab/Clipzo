/**
 * Helper to trigger direct browser file download for single or multiple files
 */
export async function triggerDownload(url: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Download fetch failed');
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1500);
    return true;
  } catch {
    // Fallback if cross-origin fetch is blocked
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return false;
  }
}

export async function downloadAllFiles(files: Array<{ url: string; name: string }>): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    await triggerDownload(file.url, file.name);
    if (i < files.length - 1) {
      // 400ms pause between downloads to prevent browser throttling/popup blocking
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}
