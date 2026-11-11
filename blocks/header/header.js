// desktop (horizontal menu with hover dropdowns) starts at 600px; below is the stacked mobile menu
const isDesktop = window.matchMedia('(min-width: 600px)');

// section order in nav.plain.html
const SECTION_NAMES = ['gov', 'tools', 'a11y', 'brand', 'search', 'partner', 'sections'];

const OVERFLOW_GAP = 20;
const A11Y_STORAGE_KEY = 'header-a11y-settings';
const FONT_STEP = 0.1;
const FONT_MIN = 0.8;
const FONT_MAX = 1.3;
const FONT_VARS = [
  '--body-font-size-m', '--body-font-size-s', '--body-font-size-xs',
  '--heading-font-size-xxl', '--heading-font-size-xl', '--heading-font-size-l',
  '--heading-font-size-m', '--heading-font-size-s', '--heading-font-size-xs',
];

let uid = 0;
const nextId = (prefix) => {
  uid += 1;
  return `${prefix}-${uid}`;
};

/**
 * Fetches the nav fragment: /content first (local preview), then the site root (DA/EDS).
 * @returns {Promise<{html: string, base: string}|null>}
 */
async function fetchNav() {
  // metadata-independent: /content first (localhost), then root (DA/EDS prod)
  let resp = await fetch('/content/nav.plain.html');
  if (!resp.ok) resp = await fetch('/nav.plain.html');
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
    img.loading = 'eager';
  });
}

const el = (tag, className, attrs = {}) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
};

const text = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');

/**
 * Creates an anchor that acts as a button (same pattern as the source header toggles),
 * with its label as visually hidden text.
 */
function buttonLink(className, label) {
  const a = el('a', className, {
    href: '#', role: 'button', title: label, 'aria-label': label,
  });
  const span = el('span', 'nav-visually-hidden');
  span.textContent = label;
  a.append(span);
  a.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      a.click();
    }
  });
  return a;
}

/**
 * Makes a trigger/panel pair a click toggle that closes on outside click and Escape.
 */
function bindToggle(trigger, panel, group) {
  const id = panel.id || nextId('nav-panel');
  panel.id = id;
  trigger.setAttribute('aria-controls', id);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    const open = trigger.getAttribute('aria-expanded') !== 'true';
    group.forEach((t) => t.setAttribute('aria-expanded', 'false'));
    trigger.setAttribute('aria-expanded', String(open));
  });
  group.push(trigger);
}

/* ---------------- accessibility tools ---------------- */

function loadA11ySettings() {
  try {
    return JSON.parse(localStorage.getItem(A11Y_STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveA11ySettings(settings) {
  try {
    localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    // storage unavailable: settings only last for this page view
  }
}

function applyFontScale(scale) {
  const root = document.documentElement;
  FONT_VARS.forEach((v) => root.style.removeProperty(v));
  if (scale === 1) return;
  const computed = getComputedStyle(root);
  FONT_VARS.forEach((v) => {
    const px = parseFloat(computed.getPropertyValue(v));
    if (px) root.style.setProperty(v, `${Math.round(px * scale * 10) / 10}px`);
  });
}

const CONTRAST_MODES = ['high-contrast', 'invert', 'saturation'];
const TOGGLE_MODES = ['highlight-links', 'text-spacing', 'line-height', 'big-cursor', 'hide-image'];

function applyA11y(settings, buttons) {
  const root = document.documentElement;
  [...CONTRAST_MODES, ...TOGGLE_MODES].forEach((m) => root.classList.remove(`a11y-${m}`));
  if (settings.contrast) root.classList.add(`a11y-${settings.contrast}`);
  TOGGLE_MODES.forEach((m) => { if (settings[m]) root.classList.add(`a11y-${m}`); });
  const scale = settings.fontScale || 1;
  applyFontScale(scale);
  buttons.forEach((btn) => {
    const { action } = btn.dataset;
    let pressed = false;
    if (action === 'normal-contrast') pressed = !settings.contrast;
    else if (CONTRAST_MODES.includes(action)) pressed = settings.contrast === action;
    else if (TOGGLE_MODES.includes(action)) pressed = !!settings[action];
    else if (action === 'font-normal') pressed = scale === 1;
    else if (action === 'font-increase') pressed = scale > 1;
    else if (action === 'font-decrease') pressed = scale < 1;
    btn.setAttribute('aria-pressed', String(pressed));
  });
}

function runA11yAction(action, settings) {
  const s = settings;
  const scale = s.fontScale || 1;
  if (action === 'normal-contrast') delete s.contrast;
  else if (CONTRAST_MODES.includes(action)) s.contrast = s.contrast === action ? undefined : action;
  else if (TOGGLE_MODES.includes(action)) s[action] = !s[action];
  else if (action === 'font-increase') s.fontScale = Math.min(FONT_MAX, Math.round((scale + FONT_STEP) * 10) / 10);
  else if (action === 'font-decrease') s.fontScale = Math.max(FONT_MIN, Math.round((scale - FONT_STEP) * 10) / 10);
  else if (action === 'font-normal') s.fontScale = 1;
  return s;
}

/**
 * Builds the accessibility tools panel from the a11y section:
 * first image = trigger icon, h2 = panel title, each h3 + list = one control group.
 */
function buildA11y(section, toolsList, group) {
  if (!section) return;
  const triggerP = section.querySelector(':scope > p');
  const triggerImg = triggerP && triggerP.querySelector('img');
  const label = text(triggerP) || (triggerImg && triggerImg.alt) || text(section.querySelector('h2'));
  const li = el('li', 'nav-tool nav-tool-a11y');
  const trigger = buttonLink('nav-tool-button', label);
  if (triggerImg) {
    triggerImg.alt = '';
    trigger.prepend(triggerImg);
  }
  const panel = el('div', 'nav-a11y-panel', { role: 'region', 'aria-label': label });
  const title = section.querySelector('h2');
  if (title) {
    const heading = el('div', 'nav-a11y-title', { role: 'heading', 'aria-level': '2' });
    heading.textContent = text(title);
    panel.append(heading);
  }
  const buttons = [];
  section.querySelectorAll('h3').forEach((h3) => {
    const list = h3.nextElementSibling;
    if (!list || list.tagName !== 'UL') return;
    const fieldset = el('fieldset', 'nav-a11y-group');
    const legend = el('legend');
    legend.textContent = text(h3);
    const ul = el('ul', 'nav-a11y-options', { 'aria-label': `${text(h3)} controls` });
    list.querySelectorAll(':scope > li').forEach((item) => {
      const a = item.querySelector('a');
      if (!a) return;
      // the authored #action link becomes a pressable control
      const action = (a.getAttribute('href') || '').replace(/^.*#/, '');
      const btn = a;
      const optLabel = text(a);
      btn.className = 'nav-a11y-option';
      btn.dataset.action = action;
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', optLabel);
      btn.setAttribute('title', optLabel);
      const img = a.querySelector('img');
      if (img) img.alt = '';
      [...btn.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).forEach((n) => n.remove());
      const span = el('span');
      span.textContent = optLabel;
      btn.append(span);
      btn.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      });
      buttons.push(btn);
      const optLi = el('li');
      optLi.append(btn);
      ul.append(optLi);
    });
    fieldset.append(legend, ul);
    panel.append(fieldset);
  });
  const settings = loadA11ySettings();
  applyA11y(settings, buttons);
  buttons.forEach((btn) => btn.addEventListener('click', (e) => {
    e.preventDefault();
    runA11yAction(btn.dataset.action, settings);
    saveA11ySettings(settings);
    applyA11y(settings, buttons);
  }));
  li.append(trigger, panel);
  toolsList.append(li);
  bindToggle(trigger, panel, group);
}

/* ---------------- rows ---------------- */

function buildTopBar(sections, group) {
  const row = el('div', 'nav-top');
  const inner = el('div', 'nav-top-inner');
  const gov = el('div', 'nav-gov');
  if (sections.gov) {
    const flag = sections.gov.querySelector('img');
    if (flag) {
      const span = el('span', 'nav-gov-flag');
      flag.setAttribute('aria-hidden', 'true');
      span.append(flag);
      gov.append(span);
    }
    const list = sections.gov.querySelector('ul');
    if (list) {
      list.className = 'nav-gov-links';
      gov.append(list);
    }
  }
  const tools = el('nav', 'nav-tools', { 'aria-label': 'Primary' });
  const toolsList = el('ul', 'nav-tools-list');
  if (sections.tools) {
    // a link wrapping an icon = direct tool (e.g. skip to content)
    sections.tools.querySelectorAll(':scope > p').forEach((p) => {
      const a = p.querySelector('a');
      const img = p.querySelector('img');
      const li = el('li', 'nav-tool');
      if (a) {
        a.className = 'nav-tool-button';
        a.setAttribute('aria-label', img ? img.alt : text(a));
        if ((a.getAttribute('href') || '').startsWith('#')) {
          li.classList.add('nav-tool-skip');
          a.addEventListener('click', (e) => {
            const main = document.querySelector('main');
            if (!main) return;
            e.preventDefault();
            main.setAttribute('tabindex', '-1');
            main.focus();
            main.scrollIntoView();
          });
        }
        li.append(a);
      } else if (img) {
        // icon followed by a list = dropdown (e.g. language selector)
        const list = p.nextElementSibling && p.nextElementSibling.tagName === 'UL' ? p.nextElementSibling : null;
        const trigger = el('button', 'nav-tool-button', { type: 'button', 'aria-label': img.alt, title: img.alt });
        trigger.append(img);
        li.classList.add('nav-tool-lang');
        li.append(trigger);
        if (list) {
          list.className = 'nav-lang-dropdown';
          li.append(list);
          bindToggle(trigger, list, group);
        }
      }
      toolsList.append(li);
    });
  }
  buildA11y(sections.a11y, toolsList, group);
  tools.append(toolsList);
  inner.append(gov, tools);
  row.append(inner);
  return row;
}

function buildSearch(section) {
  const wrap = el('div', 'nav-search');
  if (!section) return wrap;
  const a = section.querySelector('a');
  const img = section.querySelector('img');
  const label = text(a) || (img && img.alt) || 'Search';
  const url = new URL(a ? a.href : '/', window.location.href);
  const [param] = [...url.searchParams.keys()];
  const form = el('form', 'nav-search-form', { role: 'search', method: 'get', action: `${url.origin}${url.pathname}` });
  const groupEl = el('div', 'nav-search-group');
  const inputId = nextId('nav-search-input');
  const lbl = el('label', 'nav-visually-hidden', { for: inputId });
  lbl.textContent = label;
  const input = el('input', 'nav-search-input', {
    type: 'text', name: param || 's', id: inputId, placeholder: ' ', autocomplete: 'off',
  });
  const floating = el('span', 'nav-search-label', { 'aria-hidden': 'true' });
  floating.textContent = label;
  const submit = el('button', 'nav-search-submit', { type: 'submit', title: label, 'aria-label': label });
  if (img) {
    img.alt = '';
    submit.append(img);
  }
  groupEl.append(lbl, input, floating, submit);
  form.append(groupEl);
  wrap.append(form);
  return wrap;
}

function buildBrandRow(sections, hamburger) {
  const row = el('div', 'nav-brand-row');
  const inner = el('div', 'nav-brand-inner');
  const brand = el('div', 'nav-brand');
  if (sections.brand) {
    // text paragraphs (no image) hold the regional and english site names
    const nameParas = [...sections.brand.querySelectorAll(':scope > p')].filter((p) => !p.querySelector('img'));
    const logoLink = sections.brand.querySelector('a');
    const link = el('a', 'nav-brand-link', { href: logoLink ? logoLink.getAttribute('href') : '/', rel: 'home' });
    if (logoLink && logoLink.title) link.title = logoLink.title;
    const logo = sections.brand.querySelector('img');
    if (logo) {
      logo.className = 'nav-brand-logo';
      link.append(logo);
    }
    const names = el('span', 'nav-brand-text');
    nameParas.forEach((p, i) => {
      const name = el(i === 0 ? 'strong' : 'span', i === 0 ? 'nav-brand-regional' : 'nav-brand-english');
      name.textContent = text(p);
      if (i > 0) names.append(' ');
      names.append(name);
    });
    link.append(names);
    brand.append(link);
  }
  const partner = el('div', 'nav-partner');
  if (sections.partner) {
    sections.partner.querySelectorAll('a').forEach((a) => partner.append(a));
  }
  inner.append(brand, buildSearch(sections.search), partner, hamburger);
  row.append(inner);
  return row;
}

/* ---------------- main menu ---------------- */

function closeAll(scope) {
  scope.querySelectorAll('.nav-item-link[aria-expanded="true"], .nav-expand[aria-expanded="true"]')
    .forEach((t) => t.setAttribute('aria-expanded', 'false'));
}

function setExpanded(li, open) {
  const link = li.querySelector(':scope > .nav-item-link');
  const btn = li.querySelector(':scope > .nav-expand');
  if (link) link.setAttribute('aria-expanded', String(open));
  if (btn) btn.setAttribute('aria-expanded', String(open));
}

/**
 * Decorates a menu list (any depth): items with a sub list get an expandable trigger.
 */
function decorateMenu(list, depth, labels) {
  list.classList.add(depth === 0 ? 'nav-list' : 'nav-dropdown');
  [...list.children].forEach((li) => {
    li.classList.add('nav-item');
    let link = li.querySelector(':scope > a');
    const label = li.querySelector(':scope > p');
    // Document Authoring wraps list-item links in a paragraph (li > p > a): unwrap it.
    const wrapped = !link && label && label.querySelector(':scope > a');
    if (wrapped) {
      label.replaceWith(wrapped);
      link = wrapped;
    }
    if (!link && label) {
      link = el('a', '', { href: '#' });
      link.textContent = text(label);
      label.replaceWith(link);
    }
    if (!link) return;
    link.classList.add('nav-item-link');
    const sub = li.querySelector(':scope > ul');
    if (!sub) return;
    li.classList.add('nav-drop');
    sub.id = nextId('nav-sub');
    link.setAttribute('aria-expanded', 'false');
    link.setAttribute('aria-haspopup', 'true');
    link.setAttribute('aria-controls', sub.id);
    // split link: label navigates, the toggle that follows it expands the panel after it
    const btn = el('button', 'nav-expand', {
      type: 'button', 'aria-expanded': 'false', 'aria-controls': sub.id, 'aria-label': `${text(link)} ${labels.submenu}`,
    });
    li.append(btn, sub);
    decorateMenu(sub, depth + 1, labels);
  });
}

/**
 * Desktop hover: entering a dropdown item opens it (and its ancestors), leaving closes it.
 */
function bindHover(li) {
  li.addEventListener('mouseenter', () => {
    if (!isDesktop.matches || li.closest('.nav-more-panel')) return;
    let cur = li;
    while (cur) {
      setExpanded(cur, true);
      cur = cur.parentElement.closest('.nav-drop');
    }
  });
  li.addEventListener('mouseleave', (e) => {
    if (!isDesktop.matches || li.closest('.nav-more-panel') || li.contains(e.relatedTarget)) return;
    setExpanded(li, false);
    li.querySelectorAll('.nav-drop').forEach((d) => setExpanded(d, false));
  });
}

function bindMenu(menuRoot) {
  menuRoot.querySelectorAll('.nav-drop').forEach(bindHover);
  // hover (desktop row only)
  menuRoot.addEventListener('mouseover', (e) => {
    if (!isDesktop.matches) return;
    const li = e.target.closest('.nav-list .nav-drop');
    if (!li || li.closest('.nav-more-panel')) return;
    setExpanded(li, true);
  });
  menuRoot.addEventListener('mouseout', (e) => {
    if (!isDesktop.matches) return;
    if (!e.target.closest('.nav-list .nav-drop')) return;
    // close every open dropdown (any depth) the pointer has left
    menuRoot.querySelectorAll('.nav-drop').forEach((d) => {
      if (!d.contains(e.relatedTarget)) setExpanded(d, false);
    });
  });
  menuRoot.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-expand');
    const link = e.target.closest('.nav-item-link');
    const li = (btn || link) && (btn || link).closest('.nav-drop');
    if (!li) return;
    const isLabelOnly = link && link.getAttribute('href') === '#';
    if (!btn && !isLabelOnly) return; // real links navigate
    e.preventDefault();
    const open = li.querySelector(':scope > .nav-item-link').getAttribute('aria-expanded') !== 'true';
    // single-expand among siblings
    [...li.parentElement.children].forEach((sib) => { if (sib !== li) setExpanded(sib, false); });
    setExpanded(li, open);
  });
}

/**
 * Priority+ overflow: top-level items that do not fit in the menu row move to the more panel.
 */
function layoutOverflow(nav) {
  const list = nav.querySelector('.nav-list');
  const moreLi = nav.querySelector('.nav-more');
  const panelList = nav.querySelector('.nav-more-panel > ul');
  if (!list || !moreLi || !panelList) return;
  const items = nav.navItems || [];
  const wasOverflowed = items.map((li) => li.classList.contains('nav-overflowed')).join();
  items.forEach((li) => { li.classList.remove('nav-overflowed'); list.insertBefore(li, moreLi); });
  if (!isDesktop.matches) {
    moreLi.hidden = true;
    return;
  }
  moreLi.hidden = false;
  // keep breathing room before the more toggle (matches the source overflow point)
  const available = list.clientWidth - moreLi.offsetWidth - OVERFLOW_GAP;
  let used = 0;
  let cut = items.length;
  items.some((li, i) => {
    used += li.offsetWidth;
    if (used > available) { cut = i; return true; }
    return false;
  });
  if (cut === items.length) {
    moreLi.hidden = true;
    if (wasOverflowed.includes('true')) closeAll(list);
    return;
  }
  items.slice(cut).forEach((li) => { li.classList.add('nav-overflowed'); panelList.append(li); });
  // items changed rows: reset their open states
  if (items.map((li) => li.classList.contains('nav-overflowed')).join() !== wasOverflowed) {
    closeAll(list);
    closeAll(panelList);
  }
}

function buildMenuRow(section, nav) {
  const row = el('div', 'nav-menu-row');
  const sections = el('nav', 'nav-sections', { 'aria-label': 'Main menu' });
  const list = section ? section.querySelector(':scope > ul') : null;
  const extra = section ? [...section.querySelectorAll(':scope > p')].map(text) : [];
  const labels = { more: extra[0] || 'More Menu', close: extra[1] || 'Close', submenu: 'submenu' };
  if (!list) {
    row.append(sections);
    return row;
  }
  decorateMenu(list, 0, labels);
  nav.navItems = [...list.children];
  const moreLi = el('li', 'nav-more');
  const moreBtn = buttonLink('nav-more-toggle', labels.more);
  moreBtn.setAttribute('aria-haspopup', 'true');
  moreBtn.prepend(el('span', 'nav-more-icon', { 'aria-hidden': 'true' }));
  moreLi.append(moreBtn);
  list.append(moreLi);
  sections.append(list);

  const panel = el('div', 'nav-more-panel', { role: 'dialog', 'aria-label': labels.more });
  const close = el('button', 'nav-more-close', { type: 'button', title: labels.close });
  close.append(el('span', 'nav-more-close-icon', { 'aria-hidden': 'true' }), document.createTextNode(` ${labels.close}`));
  const panelList = el('ul', 'nav-more-list');
  panel.append(close, panelList);
  panel.id = nextId('nav-more');
  moreBtn.setAttribute('aria-controls', panel.id);
  moreBtn.setAttribute('aria-expanded', 'false');
  moreBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const open = moreBtn.getAttribute('aria-expanded') !== 'true';
    moreBtn.setAttribute('aria-expanded', String(open));
    if (open) close.focus();
  });
  close.addEventListener('click', () => {
    moreBtn.setAttribute('aria-expanded', 'false');
    moreBtn.focus();
  });
  bindMenu(list);
  bindMenu(panelList);
  row.append(sections, panel);
  return row;
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const navData = await fetchNav();
  if (!navData) return;
  const fragment = document.createElement('div');
  fragment.innerHTML = navData.html;
  resolveMedia(fragment, navData.base);

  const sections = {};
  [...fragment.querySelectorAll(':scope > div')].forEach((div, i) => {
    if (SECTION_NAMES[i]) sections[SECTION_NAMES[i]] = div;
  });

  block.textContent = '';
  const nav = el('div', 'nav-container', { id: 'nav', 'aria-expanded': 'false' });
  const toggleGroup = [];

  const menuRow = buildMenuRow(sections.sections, nav);
  const hamburger = el('button', 'nav-hamburger', {
    type: 'button', 'aria-expanded': 'false', 'aria-label': 'Menu Toggle', title: 'Menu Toggle',
  });
  hamburger.append(el('span', 'nav-hamburger-icon', { 'aria-hidden': 'true' }));
  const menuId = nextId('nav-menu');
  menuRow.id = menuId;
  hamburger.setAttribute('aria-controls', menuId);
  hamburger.addEventListener('click', () => {
    const open = nav.getAttribute('aria-expanded') !== 'true';
    nav.setAttribute('aria-expanded', String(open));
    hamburger.setAttribute('aria-expanded', String(open));
  });

  nav.append(buildTopBar(sections, toggleGroup), buildBrandRow(sections, hamburger), menuRow);

  // links to other sites open in a new window (own site = this origin + the home link host)
  const homeLink = nav.querySelector('.nav-brand-link');
  const ownHosts = [window.location.host, homeLink ? new URL(homeLink.href).host : ''];
  nav.querySelectorAll('a[href^="http"]').forEach((a) => {
    if (ownHosts.includes(new URL(a.href).host)) return;
    a.target = '_blank';
    a.rel = 'noopener';
  });

  const navWrapper = el('div', 'nav-wrapper');
  navWrapper.append(nav);
  block.append(navWrapper);

  // close click toggles on outside click / Escape
  document.addEventListener('click', (e) => {
    toggleGroup.forEach((t) => {
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (!t.contains(e.target) && !(panel && panel.contains(e.target))) t.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    toggleGroup.forEach((t) => t.setAttribute('aria-expanded', 'false'));
    const more = nav.querySelector('.nav-more-toggle[aria-expanded="true"]');
    if (more) more.setAttribute('aria-expanded', 'false');
    if (isDesktop.matches) closeAll(nav.querySelector('.nav-list'));
  });

  // priority+ overflow + viewport changes
  const relayout = () => layoutOverflow(nav);
  let raf;
  const scheduleRelayout = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(relayout);
  };
  relayout();
  if (document.fonts) document.fonts.ready.then(scheduleRelayout);
  window.addEventListener('load', scheduleRelayout);
  // only width changes affect the overflow (expanding a submenu changes the height)
  let lastWidth = 0;
  new ResizeObserver(([entry]) => {
    const width = Math.round(entry.contentRect.width);
    if (width === lastWidth) return;
    lastWidth = width;
    scheduleRelayout();
  }).observe(menuRow.querySelector('.nav-sections'));
  isDesktop.addEventListener('change', () => {
    // reset every open state when crossing the breakpoint
    nav.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-expanded', 'false');
    toggleGroup.forEach((t) => t.setAttribute('aria-expanded', 'false'));
    const more = nav.querySelector('.nav-more-toggle');
    if (more) more.setAttribute('aria-expanded', 'false');
    closeAll(nav);
    relayout();
  });
}
