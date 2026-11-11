/*
 * Table Data Block
 * Plain data table. The first row is the header row; each later row is a data row.
 * Rows with fewer cells are padded so columns stay aligned; empty rows are dropped.
 * Each body cell carries its column header in `data-th` so narrow screens can show
 * the rows as stacked label/value cards (as the source theme does).
 */

/**
 * Content nodes of an authored cell; a lone paragraph is unwrapped to its inline content.
 * @param {Element} cell
 * @returns {{nodes: Node[], inline: boolean}}
 */
function cellContent(cell) {
  if (!cell) return { nodes: [], inline: true };
  const elements = [...cell.children];
  const onlyP = elements.length === 1 && elements[0].tagName === 'P'
    && ![...cell.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
  if (onlyP) return { nodes: [...elements[0].childNodes], inline: true };
  const block = elements.some((el) => !/^(A|SPAN|STRONG|EM|B|I|U|BR|CODE|SUB|SUP|PICTURE|IMG)$/.test(el.tagName));
  return { nodes: [...cell.childNodes], inline: !block };
}

export default function decorate(block) {
  const rows = [...block.children].filter((row) => row.textContent.trim() || row.querySelector('img, picture'));
  if (!rows.length) return;

  const width = Math.max(...rows.map((row) => row.children.length || 1));
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');
  const labels = [];

  rows.forEach((row, i) => {
    const isHead = i === 0 && rows.length > 1;
    const tr = document.createElement('tr');
    const cells = row.children.length ? [...row.children] : [row];
    for (let c = 0; c < width; c += 1) {
      const cell = cells[c];
      const el = document.createElement(isHead ? 'th' : 'td');
      const { nodes, inline } = cellContent(cell);
      if (isHead) {
        el.setAttribute('scope', 'col');
        labels[c] = cell ? cell.textContent.trim() : '';
        el.append(...nodes);
      } else {
        if (labels[c]) el.dataset.th = labels[c];
        const value = document.createElement(inline ? 'span' : 'div');
        value.className = 'table-data-value';
        value.append(...nodes);
        el.append(value);
      }
      tr.append(el);
    }
    (isHead ? thead : tbody).append(tr);
  });

  if (thead.children.length) table.append(thead);
  table.append(tbody);

  const scroller = document.createElement('div');
  scroller.className = 'table-data-scroll';
  scroller.append(table);
  block.replaceChildren(scroller);
}
