export function formatSnippetText(text: string): string {
  if (text.startsWith('FILE::')) {
    const parts = text.split('::');
    const name = parts[2] || 'File';
    return `📁 ${name}`;
  }
  return text.replace(/\n/g, ' ');
}
