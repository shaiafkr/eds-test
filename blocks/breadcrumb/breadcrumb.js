/*
 * Breadcrumb Block
 * Default: a breadcrumb trail (Home > Section > Current page).
 * `alt` option: a compact row of share / social links (no separators).
 *
 * Authoring is forgiving: items may be a list, one paragraph per item,
 * one cell or row per item, or a single line of links separated by > or ›.
 */

const SEPARATORS = /\s*[>›»]\s*/;

/**
 * Collects trail items, in document order, from any authored shape.
 * Link items keep the authored anchor (so icons survive); text becomes a span.
 * @param {Element} block
 * @returns {Element[]}
 */
function collectItems(block) {
  const items = [];
  const pushText = (text) => {
    text.split(SEPARATORS).map((t) => t.trim()).filter(Boolean).forEach((t) => {
      const span = document.createElement('span');
      span.textContent = t;
      items.push(span);
    });
  };

  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName === 'A') {
      items.push(node);
      return;
    }
    // keep standalone icons (e.g. :facebook: without a link) as items
    if (node.matches('span.icon, picture') && !node.closest('a')) {
      items.push(node);
      return;
    }
    [...node.childNodes].forEach(walk);
  };

  [...block.children].forEach((row) => {
    const cells = row.children.length ? [...row.children] : [row];
    cells.forEach((cell) => [...cell.childNodes].forEach(walk));
  });
  return items;
}

function isCurrentPage(el) {
  if (el.tagName !== 'A') return true;
  try {
    const url = new URL(el.href, window.location.href);
    const norm = (p) => p.replace(/\/$/, '');
    return url.origin === window.location.origin
      && norm(url.pathname) === norm(window.location.pathname);
  } catch {
    return false;
  }
}

function decorateTrail(block, items) {
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Breadcrumb');
  const ol = document.createElement('ol');
  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'breadcrumb-item';
    const last = i === items.length - 1;
    if (last && isCurrentPage(item)) {
      li.classList.add('breadcrumb-current');
      li.setAttribute('aria-current', 'page');
    }
    // plain-text items (spans from collectItems) go in as text, links/icons as elements
    if (item.tagName === 'SPAN' && !item.attributes.length) li.append(item.textContent);
    else li.append(item);
    ol.append(li);
  });
  nav.append(ol);
  block.replaceChildren(nav);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/* share icons, paths and fills from the source site (agra.nic.in printShare row) */
const SHARE_ICONS = {
  facebook: {
    viewBox: '0 0 64 64',
    fill: '#29136c',
    d: 'M35.8501 0.443442C30.0491 1.68828 25.7794 5.55971 24.2358 11.0121C23.5511 13.452 23.4017 14.7839 23.4017 18.73V21.6554H20.3146C16.6174 21.6554 16.1942 21.7425 15.2979 22.6388C14.3393 23.5973 14.3145 23.7343 14.3145 29.697C14.3145 32.834 14.3642 35.0747 14.4514 35.4357C14.6257 36.2449 15.136 36.942 15.8705 37.4025L16.468 37.776L19.9287 37.8133L23.4017 37.8507L23.4266 49.826L23.464 61.8013L23.7378 62.3117C24.0491 62.9092 24.7711 63.5689 25.3437 63.8055C25.9536 64.0544 37.4061 64.0544 38.0161 63.8055C38.5887 63.5689 39.3107 62.9092 39.6219 62.3117L39.8958 61.8013L39.9331 49.8135L39.958 37.8382H43.8544C46.232 37.8382 47.925 37.7884 48.2237 37.7013C48.8212 37.5395 49.7549 36.6805 50.0536 36.0332C50.2652 35.5726 50.2901 35.0872 50.2901 29.7468V23.9583L49.9167 23.2986C49.4561 22.5019 48.7466 21.9666 47.9125 21.7923C47.5515 21.7052 45.7589 21.6554 43.6178 21.6554H39.9331L39.9829 19.0039C40.0078 17.5599 40.0701 16.2777 40.1323 16.1657C40.3439 15.6927 40.7796 15.6304 44.6884 15.5557C48.2735 15.4935 48.51 15.481 48.9831 15.2196C49.5059 14.9458 49.954 14.4976 50.3648 13.8752C50.5889 13.5266 50.6014 13.1905 50.6387 8.14896C50.6636 5.19871 50.6387 2.6219 50.6014 2.41028C50.5018 1.83766 49.9042 1.01607 49.2943 0.60527L48.759 0.244268L42.7091 0.256717C38.0285 0.256717 36.4725 0.30651 35.8501 0.443442ZM46.8046 7.83775V11.6967H44.0784C40.9663 11.6967 39.8335 11.8461 38.6261 12.4436C37.3065 13.0909 36.4849 14.3233 36.2235 16.0288C36.1364 16.5267 36.099 18.3939 36.1239 20.5475L36.1613 24.2322L36.4974 24.6679C37.1323 25.5019 37.1945 25.5144 42.0618 25.5144H46.4312V29.7468V33.9668L41.9747 34.0042L37.5057 34.0415L37.0576 34.3527C36.7961 34.527 36.4849 34.888 36.348 35.1743C36.099 35.6598 36.099 35.9585 36.099 47.8965V60.1208H31.6799H27.2607V47.9338C27.2607 39.6308 27.2234 35.6224 27.1238 35.3859C26.9371 34.8631 26.2773 34.2407 25.7669 34.1037C25.5304 34.0415 23.7254 33.9793 21.7586 33.9793H18.1734V29.7468V25.5144H21.9204C26.103 25.5144 26.2275 25.4895 26.8624 24.6679L27.1985 24.2322L27.2732 19.4272C27.3479 14.2984 27.4101 13.7507 28.0823 11.7216C28.8292 9.48093 30.1238 7.63858 31.8417 6.3564C33.4724 5.16136 35.4144 4.38956 37.7173 4.05346C37.8916 4.02856 40.0078 4.00367 42.4228 3.99122L46.8046 3.97877V7.83775Z',
  },
  x: {
    viewBox: '0 0 55 55',
    fill: '#000',
    d: 'M29.7042 21.15L48.2833 0H43.8812L27.7417 18.3604L14.8604 0H0L19.4833 27.7667L0 49.9437H4.40208L21.4354 30.55L35.0417 49.9437H49.9021L29.7042 21.15ZM23.6729 28.0104L21.6958 25.2437L5.98958 3.25H12.7521L25.4312 21.0062L27.4 23.7729L43.8792 46.8521H37.1167L23.6729 28.0104Z',
  },
};

function shareNetwork(a) {
  try {
    const host = new URL(a.href, window.location.href).hostname.replace(/^www\./, '');
    if (host.endsWith('facebook.com')) return 'facebook';
    if (host === 'x.com' || host.endsWith('twitter.com')) return 'x';
  } catch {
    // unknown network
  }
  return null;
}

function shareIcon(network) {
  const { viewBox, fill, d } = SHARE_ICONS[network];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', fill);
  svg.append(path);
  const span = document.createElement('span');
  span.className = `breadcrumb-share-icon breadcrumb-share-${network}`;
  span.append(svg);
  return span;
}

/** Text-only share links get the network icon; the text stays for screen readers. */
function addShareIcon(a) {
  if (a.querySelector('svg, img, .icon')) return;
  const network = shareNetwork(a);
  if (!network) return;
  const label = document.createElement('span');
  label.className = 'breadcrumb-share-label';
  label.append(...a.childNodes);
  a.replaceChildren(shareIcon(network), label);
}

function decorateShare(block, items) {
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Share');
  const ul = document.createElement('ul');
  items.filter((item) => item.tagName === 'A').forEach((a) => {
    const li = document.createElement('li');
    li.className = 'breadcrumb-share-item';
    addShareIcon(a);
    // icon-only links need an accessible name
    if (!a.textContent.trim() && !a.getAttribute('aria-label')) {
      const icon = a.querySelector('.icon');
      const name = a.title
        || [...(icon?.classList || [])].find((c) => c.startsWith('icon-'))?.slice(5)
        || a.querySelector('img')?.alt
        || 'Share';
      a.setAttribute('aria-label', name);
    }
    try {
      if (new URL(a.href, window.location.href).origin !== window.location.origin) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    } catch {
      // leave malformed hrefs as authored
    }
    li.append(a);
    ul.append(li);
  });
  nav.append(ul);
  block.replaceChildren(nav);
}

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const items = collectItems(block);
  if (!items.length) {
    block.replaceChildren();
    block.classList.add('breadcrumb-empty');
    return;
  }
  if (block.classList.contains('alt')) decorateShare(block, items);
  else decorateTrail(block, items);
}
