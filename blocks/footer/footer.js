// back-to-top control appears once the page has scrolled this far (px)
const BACK_TO_TOP_OFFSET = 200;

/**
 * Fetches the footer fragment: /content first (local preview), then the site root (DA/EDS).
 * @returns {Promise<{html: string, base: string}|null>}
 */
async function fetchFooter() {
  // metadata-independent: /content first (localhost), then root (DA/EDS prod)
  let resp = await fetch('/content/footer.plain.html');
  if (!resp.ok) resp = await fetch('/footer.plain.html');
  if (!resp.ok) return null;
  return { html: await resp.text(), base: new URL(resp.url, window.location.href).href };
}

/**
 * Resolves relative image sources against the fragment URL so they work on every page.
 * @param {Element} root fragment root
 * @param {string} base fragment URL
 */
function resolveMedia(root, base) {
  root.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (!/^(https?:|data:|\/)/.test(src)) img.src = new URL(src, base).href;
    img.loading = 'lazy';
  });
}

const el = (tag, className) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
};

const text = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');

/**
 * True when the section is only a single in-page link (e.g. "Back to top").
 * @param {Element} section fragment section
 */
function isInPageLinkSection(section) {
  const links = section.querySelectorAll('a');
  if (links.length !== 1) return false;
  const href = links[0].getAttribute('href') || '';
  return href.startsWith('#') && text(section) === text(links[0]);
}

/**
 * Classifies a fragment section by its content so authors can reorder or omit sections.
 * @param {Element} section fragment section
 * @returns {'top'|'logos'|'links'|'text'|'empty'}
 */
function classifySection(section) {
  if (!text(section) && !section.querySelector('img')) return 'empty';
  if (isInPageLinkSection(section)) return 'top';
  const items = [...section.querySelectorAll('li')];
  if (items.length && items.every((li) => li.querySelector('a img') && !text(li))) return 'logos';
  if (section.querySelector('h1, h2, h3, h4, h5, h6, ul, ol') && !section.querySelector('img')) return 'links';
  return 'text';
}

/**
 * Opens links that leave this site in a new tab (inline text and logo links, as on the source).
 * @param {Element} root container whose links are checked
 */
function openOffsiteLinksInNewTab(root) {
  root.querySelectorAll('a[href]').forEach((a) => {
    let url;
    try {
      url = new URL(a.href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
  });
}

/**
 * Builds the floating back-to-top control from an authored in-page link.
 * @param {Element} section fragment section holding the link
 * @returns {HTMLButtonElement}
 */
function buildBackToTop(section) {
  const label = text(section.querySelector('a'));
  const button = el('button', 'footer-backtotop');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  const hidden = el('span', 'footer-visually-hidden');
  hidden.textContent = label;
  button.append(hidden);

  const update = () => button.classList.toggle('is-visible', window.scrollY > BACK_TO_TOP_OFFSET);
  window.addEventListener('scroll', update, { passive: true });
  update();

  button.addEventListener('click', (e) => {
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
  return button;
}

/**
 * Turns one authored section into a footer column.
 * @param {Element} section fragment section
 * @param {string} kind section classification
 * @returns {HTMLElement}
 */
function buildColumn(section, kind) {
  const column = el('div', `footer-column footer-column-${kind}`);
  column.append(...section.childNodes);
  if (kind === 'links') {
    column.querySelectorAll('ul, ol').forEach((list) => list.classList.add('footer-link-list'));
  }
  if (kind === 'logos') {
    column.querySelectorAll('ul, ol').forEach((list) => list.classList.add('footer-logo-list'));
    openOffsiteLinksInNewTab(column);
  }
  if (kind === 'text') openOffsiteLinksInNewTab(column);
  return column;
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const fragment = await fetchFooter();
  block.textContent = '';
  if (!fragment) return;

  const root = document.createElement('div');
  root.innerHTML = fragment.html;
  resolveMedia(root, fragment.base);

  const container = el('div', 'footer-container');
  let backToTop = null;
  [...root.children].forEach((section) => {
    const kind = classifySection(section);
    if (kind === 'empty') return;
    if (kind === 'top') {
      if (!backToTop) backToTop = buildBackToTop(section);
      return;
    }
    container.append(buildColumn(section, kind));
  });

  block.append(container);
  if (backToTop) block.append(backToTop);
}
