export function cleanMarkdown(md: string): string {
  if (!md || typeof md !== 'string') {
    return md;
  }

  let result = md;

  result = result.replace(/^-([^*\-])/gm, '- $1');

  result = result.replace(/\*\*([^*]+)\*\*\*/g, '**$1**');

  result = result.replace(/^(\s*)\*([^ ])/gm, '$1* $2');

  result = result.replace(/(\*\*[^*]+\*\*)\s*\*$/g, '$1');

  result = result.replace(/"([^"]+)"/g, '"$1"');

  result = result.replace(/'([^']+)'/g, "'$1'");

  result = result.replace(/\*\*\s*\*\*/g, '****');

  result = result.replace(/^\s+$/gm, '');

  return result;
}
