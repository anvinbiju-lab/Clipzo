export function formatSnippetText(text: string): string {
  if (text.startsWith('FILES::')) {
    try {
      const files = JSON.parse(text.substring('FILES::'.length));
      return `📦 ${files.length} Files`;
    } catch {
      return '📦 Multiple Files';
    }
  }
  if (text.startsWith('FILE::')) {
    const parts = text.split('::');
    const name = parts[2] || 'File';
    return `📁 ${name}`;
  }
  return text.replace(/\n/g, ' ');
}
