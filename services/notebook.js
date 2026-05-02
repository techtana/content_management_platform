const yaml = require('js-yaml');

function convertNotebook(ipynbContent) {
  const nb = JSON.parse(ipynbContent);
  const cells = nb.cells || [];
  const lines = [];
  let frontmatter = {};

  let firstCell = true;
  for (const cell of cells) {
    const source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');

    if (firstCell && cell.cell_type === 'raw') {
      try {
        frontmatter = yaml.load(source) || {};
      } catch {
        lines.push(source);
      }
      firstCell = false;
      continue;
    }
    firstCell = false;

    if (cell.cell_type === 'markdown') {
      lines.push(source);
      lines.push('');
    } else if (cell.cell_type === 'code') {
      lines.push('```python');
      lines.push(source);
      lines.push('```');
      lines.push('');

      const outputs = cell.outputs || [];
      for (const output of outputs) {
        if (output.output_type === 'stream') {
          const text = Array.isArray(output.text) ? output.text.join('') : (output.text || '');
          if (text.trim()) {
            lines.push('```');
            lines.push(text.trimEnd());
            lines.push('```');
            lines.push('');
          }
        } else if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
          const textData = output.data?.['text/plain'];
          if (textData) {
            const text = Array.isArray(textData) ? textData.join('') : textData;
            if (text.trim()) {
              lines.push('```');
              lines.push(text.trimEnd());
              lines.push('```');
              lines.push('');
            }
          }
        }
      }
    }
  }

  return { markdown: lines.join('\n'), frontmatter };
}

module.exports = { convertNotebook };
