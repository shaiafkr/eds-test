/*
 * Listing Filter Block
 * A listing title with a category dropdown that filters the cards-listing
 * block(s) on the same page.
 *
 * Rows (all optional, order-independent):
 *   - a heading (the listing title)
 *   - label | options: e.g. "Filter" | "Historic, Religious" (or a list)
 * When no options are authored they are taken from the cards-listing categories.
 *
 * Dispatches `listing-filter:change` on document with detail { value } ('' = all).
 */

const ALL_VALUE = '';

function splitOptions(cell) {
  const lis = cell.querySelectorAll('li');
  const raw = lis.length
    ? [...lis].map((li) => li.textContent)
    : cell.textContent.split(/[,\n]/);
  return raw.map((t) => t.trim()).filter(Boolean);
}

function readAuthored(block) {
  const result = {
    heading: null, label: '', allLabel: 'All', options: [],
  };
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const heading = row.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading && !result.heading) {
      result.heading = heading;
      return;
    }
    if (!cells.length) return;
    if (cells.length >= 2) {
      result.label = cells[0].textContent.trim().replace(/:$/, '');
      result.options.push(...splitOptions(cells[1]));
    } else if (!result.heading && !cells[0].querySelector('ul, ol') && !result.label) {
      // a single plain-text cell before any heading is the title
      const text = cells[0].textContent.trim();
      if (text) {
        const h = document.createElement('h2');
        h.textContent = text;
        result.heading = h;
      }
    } else if (cells[0].querySelector('ul, ol')) {
      result.options.push(...splitOptions(cells[0]));
    } else {
      // "Filter" or "Filter: A, B" in one cell
      const text = cells[0].textContent.trim();
      const m = text.match(/^([^:]{1,40}):\s*(.*)$/s);
      if (m) {
        result.label = m[1].trim();
        result.options.push(...m[2].split(/[,\n]/).map((t) => t.trim()).filter(Boolean));
      } else if (/^(filter|category|categories)\b/i.test(text)) {
        result.label = text;
      } else {
        result.options.push(...splitOptions(cells[0]));
      }
    }
  });
  // an authored "All" entry becomes the reset option label rather than a category
  const allIdx = result.options.findIndex((o) => /^all$/i.test(o));
  if (allIdx > -1) [result.allLabel] = result.options.splice(allIdx, 1);
  result.options = [...new Set(result.options)];
  return result;
}

function fillSelect(select, allLabel, options) {
  const current = select.value;
  select.replaceChildren();
  const all = document.createElement('option');
  all.value = ALL_VALUE;
  all.textContent = allLabel;
  select.append(all);
  options.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    select.append(opt);
  });
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

function listingCategories() {
  const cats = new Set();
  document.querySelectorAll('.cards-listing[data-categories]').forEach((el) => {
    try {
      JSON.parse(el.dataset.categories).forEach((c) => cats.add(c));
    } catch {
      // ignore malformed data
    }
  });
  return [...cats];
}

let instance = 0;

export default function decorate(block) {
  const authored = readAuthored(block);
  instance += 1;
  const id = `listing-filter-${instance}`;

  const header = document.createElement('div');
  header.className = 'listing-filter-title';
  if (authored.heading) header.append(authored.heading);

  const control = document.createElement('div');
  control.className = 'listing-filter-control';
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = `${authored.label || 'Filter'}:`;
  const select = document.createElement('select');
  select.id = id;
  select.name = 'category';
  control.append(label, select);

  const authoredOptions = authored.options.length > 0;
  fillSelect(select, authored.allLabel, authoredOptions ? authored.options : listingCategories());

  if (!authoredOptions) {
    document.addEventListener('cards-listing:ready', () => {
      fillSelect(select, authored.allLabel, listingCategories());
    });
  }

  select.addEventListener('change', () => {
    document.dispatchEvent(new CustomEvent('listing-filter:change', {
      detail: { value: select.value },
    }));
  });

  block.replaceChildren(header, control);
}
