export function formatSnippetText(text: string): string {
  if (text.startsWith('PROGRAMS::')) {
    try {
      const programs = JSON.parse(text.substring('PROGRAMS::'.length));
      const names = programs.map((p: any) => p.name).slice(0, 2).join(', ');
      return `💻 ${programs.length} Lab Programs (${names}${programs.length > 2 ? '…' : ''})`;
    } catch {
      return '💻 Lab Programs Set';
    }
  }
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
