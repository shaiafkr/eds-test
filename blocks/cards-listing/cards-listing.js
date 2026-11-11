/*
 * Cards Listing Block
 * Paginated grid of listing cards (image, title, category line, teaser, share links).
 * One row per card. Cells: image | body | optional footer (share links).
 *
 * Filtering: listens for the `listing-filter:change` event dispatched by the
 * listing-filter block (detail: { value }) and matches it against each card's
 * categories, read from a body line starting with "Category".
 * Exposes `data-categories` on the block and dispatches `cards-listing:ready`
 * so a filter can build its options from the cards.
 */
import { createOptimizedPicture } from '../../scripts/aem.js';

const PAGE_SIZE = 10;
const CATEGORY_LINE = /^\s*categor(y|ies)\s*[:>›»]?\s*/i;
const SVG_NS = 'http://www.w3.org/2000/svg';

/* share icons (paths from the source site's share links) */
const SHARE_ICONS = [
  {
    name: 'facebook',
    test: /(^|\.)facebook\.com$/i,
    viewBox: '0 0 64 64',
    path: 'M35.8501 0.443442C30.0491 1.68828 25.7794 5.55971 24.2358 11.0121C23.5511 13.452 23.4017 14.7839 23.4017 18.73V21.6554H20.3146C16.6174 21.6554 16.1942 21.7425 15.2979 22.6388C14.3393 23.5973 14.3145 23.7343 14.3145 29.697C14.3145 32.834 14.3642 35.0747 14.4514 35.4357C14.6257 36.2449 15.136 36.942 15.8705 37.4025L16.468 37.776L19.9287 37.8133L23.4017 37.8507L23.4266 49.826L23.464 61.8013L23.7378 62.3117C24.0491 62.9092 24.7711 63.5689 25.3437 63.8055C25.9536 64.0544 37.4061 64.0544 38.0161 63.8055C38.5887 63.5689 39.3107 62.9092 39.6219 62.3117L39.8958 61.8013L39.9331 49.8135L39.958 37.8382H43.8544C46.232 37.8382 47.925 37.7884 48.2237 37.7013C48.8212 37.5395 49.7549 36.6805 50.0536 36.0332C50.2652 35.5726 50.2901 35.0872 50.2901 29.7468V23.9583L49.9167 23.2986C49.4561 22.5019 48.7466 21.9666 47.9125 21.7923C47.5515 21.7052 45.7589 21.6554 43.6178 21.6554H39.9331L39.9829 19.0039C40.0078 17.5599 40.0701 16.2777 40.1323 16.1657C40.3439 15.6927 40.7796 15.6304 44.6884 15.5557C48.2735 15.4935 48.51 15.481 48.9831 15.2196C49.5059 14.9458 49.954 14.4976 50.3648 13.8752C50.5889 13.5266 50.6014 13.1905 50.6387 8.14896C50.6636 5.19871 50.6387 2.6219 50.6014 2.41028C50.5018 1.83766 49.9042 1.01607 49.2943 0.60527L48.759 0.244268L42.7091 0.256717C38.0285 0.256717 36.4725 0.30651 35.8501 0.443442ZM46.8046 7.83775V11.6967H44.0784C40.9663 11.6967 39.8335 11.8461 38.6261 12.4436C37.3065 13.0909 36.4849 14.3233 36.2235 16.0288C36.1364 16.5267 36.099 18.3939 36.1239 20.5475L36.1613 24.2322L36.4974 24.6679C37.1323 25.5019 37.1945 25.5144 42.0618 25.5144H46.4312V29.7468V33.9668L41.9747 34.0042L37.5057 34.0415L37.0576 34.3527C36.7961 34.527 36.4849 34.888 36.348 35.1743C36.099 35.6598 36.099 35.9585 36.099 47.8965V60.1208H31.6799H27.2607V47.9338C27.2607 39.6308 27.2234 35.6224 27.1238 35.3859C26.9371 34.8631 26.2773 34.2407 25.7669 34.1037C25.5304 34.0415 23.7254 33.9793 21.7586 33.9793H18.1734V29.7468V25.5144H21.9204C26.103 25.5144 26.2275 25.4895 26.8624 24.6679L27.1985 24.2322L27.2732 19.4272C27.3479 14.2984 27.4101 13.7507 28.0823 11.7216C28.8292 9.48093 30.1238 7.63858 31.8417 6.3564C33.4724 5.16136 35.4144 4.38956 37.7173 4.05346C37.8916 4.02856 40.0078 4.00367 42.4228 3.99122L46.8046 3.97877V7.83775Z',
  },
  {
    name: 'x',
    test: /(^|\.)(x|twitter)\.com$/i,
    viewBox: '0 0 55 55',
    path: 'M29.7042 21.15L48.2833 0H43.8812L27.7417 18.3604L14.8604 0H0L19.4833 27.7667L0 49.9437H4.40208L21.4354 30.55L35.0417 49.9437H49.9021L29.7042 21.15ZM23.6729 28.0104L21.6958 25.2437L5.98958 3.25H12.7521L25.4312 21.0062L27.4 23.7729L43.8792 46.8521H37.1167L23.6729 28.0104Z',
  },
];

function optimizeImages(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}

function isImageCell(cell) {
  const pics = cell.querySelectorAll('picture, img');
  return pics.length > 0 && !cell.textContent.trim();
}

function isLinksOnlyCell(cell) {
  const links = cell.querySelectorAll('a');
  if (!links.length) return false;
  const text = [...links].reduce((t, a) => t.replace(a.textContent, ''), cell.textContent);
  return !text.trim();
}

/**
 * Finds the "Category > A, B" line in the body, tags it, and returns the categories.
 * @param {Element} body
 * @returns {string[]}
 */
function readCategories(body) {
  if (!body) return [];
  const line = [...body.querySelectorAll('p, li, div')]
    .find((el) => !el.querySelector('p, li, div') && CATEGORY_LINE.test(el.textContent));
  if (!line) return [];
  line.classList.add('cards-listing-category');
  const text = line.textContent;
  const label = text.match(CATEGORY_LINE)[0].replace(/[:>›»]/g, '').trim();
  const value = text.replace(CATEGORY_LINE, '').trim();
  // "Category: A, B" -> <strong>Category</strong> [chevron] <span>A, B</span>
  const strong = document.createElement('strong');
  strong.textContent = label;
  const sep = document.createElement('span');
  sep.className = 'cards-listing-category-sep';
  sep.setAttribute('aria-hidden', 'true');
  const values = document.createElement('span');
  values.textContent = value;
  line.replaceChildren(strong, sep, values);
  return value.split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

function shareIcon(href) {
  let host = '';
  try {
    host = new URL(href, window.location.href).hostname;
  } catch { /* not a URL */ }
  const icon = SHARE_ICONS.find((i) => i.test.test(host));
  if (!icon) return null;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `cards-listing-share-icon cards-listing-share-${icon.name}`);
  svg.setAttribute('viewBox', icon.viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', icon.path);
  svg.append(path);
  return svg;
}

/**
 * Turns the share-links cell into a list of icon links; the link text stays
 * for screen readers. Links to unknown networks keep their visible text.
 * @param {Element} footer
 */
function decorateShareLinks(footer) {
  const ul = document.createElement('ul');
  ul.className = 'cards-listing-share';
  footer.querySelectorAll('a').forEach((a) => {
    a.classList.remove('button', 'primary', 'secondary', 'accent');
    const icon = shareIcon(a.getAttribute('href'));
    if (icon) {
      const label = document.createElement('span');
      label.className = 'cards-listing-sr-only';
      label.textContent = a.textContent.trim();
      a.replaceChildren(icon, label);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    const li = document.createElement('li');
    li.append(a);
    ul.append(li);
  });
  footer.replaceChildren(ul);
}

function buildCard(row) {
  const li = document.createElement('li');
  li.className = 'cards-listing-card';
  const cells = [...row.children].filter((c) => c.children.length || c.textContent.trim());
  let body = null;
  cells.forEach((cell) => {
    if (isImageCell(cell) && !li.querySelector('.cards-listing-card-image')) {
      cell.className = 'cards-listing-card-image';
    } else if (!body) {
      cell.className = 'cards-listing-card-body';
      body = cell;
    } else if (isLinksOnlyCell(cell)) {
      cell.className = 'cards-listing-card-footer';
    } else {
      // extra text cells join the body so author additions are not lost
      body.append(...cell.childNodes);
      return;
    }
    li.append(cell);
  });
  // card with only a share-links cell and no body: treat it as the body
  if (!body) {
    const footer = li.querySelector('.cards-listing-card-footer');
    if (footer) footer.className = 'cards-listing-card-body';
  }
  const shareCell = li.querySelector('.cards-listing-card-footer');
  if (shareCell) decorateShareLinks(shareCell);
  const categories = readCategories(body);
  li.dataset.categories = JSON.stringify(categories);
  return { li, categories };
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  const allCategories = new Set();
  [...block.children].forEach((row) => {
    if (!row.textContent.trim() && !row.querySelector('picture, img')) return;
    const { li, categories } = buildCard(row);
    categories.forEach((c) => allCategories.add(c));
    ul.append(li);
  });
  optimizeImages(ul);

  const pager = document.createElement('nav');
  pager.className = 'cards-listing-pager';
  pager.setAttribute('aria-label', 'Pagination');

  const empty = document.createElement('p');
  empty.className = 'cards-listing-empty';
  empty.textContent = 'No items match the selected filter.';
  empty.hidden = true;

  const cards = [...ul.children];
  const state = { filter: '', page: 1 };

  const matches = (li) => {
    if (!state.filter) return true;
    const cats = JSON.parse(li.dataset.categories || '[]').map((c) => c.toLowerCase());
    return cats.includes(state.filter.toLowerCase());
  };

  const render = () => {
    const visible = cards.filter(matches);
    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), pages);
    const start = (state.page - 1) * PAGE_SIZE;
    const shown = new Set(visible.slice(start, start + PAGE_SIZE));
    cards.forEach((li) => { li.hidden = !shown.has(li); });
    empty.hidden = visible.length > 0;

    pager.replaceChildren();
    pager.hidden = pages <= 1;
    if (pages <= 1) return;
    const mkBtn = (label, text, page, disabled) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cards-listing-pager-${label}`;
      btn.setAttribute('aria-label', label === 'prev' ? 'Previous page' : 'Next page');
      btn.textContent = text;
      btn.disabled = disabled;
      btn.addEventListener('click', () => {
        state.page = page;
        render();
        block.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
      return btn;
    };
    const status = document.createElement('span');
    status.className = 'cards-listing-pager-status';
    status.setAttribute('aria-live', 'polite');
    status.textContent = `Page ${state.page} of ${pages}`;
    pager.append(
      mkBtn('prev', '«', state.page - 1, state.page === 1),
      status,
      mkBtn('next', '»', state.page + 1, state.page === pages),
    );
  };

  block.replaceChildren(ul, empty, pager);
  block.dataset.categories = JSON.stringify([...allCategories]);

  document.addEventListener('listing-filter:change', (e) => {
    state.filter = (e.detail && e.detail.value) || '';
    state.page = 1;
    render();
  });

  // pick up a filter that was decorated (and maybe changed) before this block
  const select = document.querySelector('.listing-filter select');
  if (select) state.filter = select.value;
  render();

  document.dispatchEvent(new CustomEvent('cards-listing:ready', {
    detail: { block, categories: [...allCategories] },
  }));
}
