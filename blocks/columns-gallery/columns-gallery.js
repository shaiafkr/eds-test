/*
 * Columns Gallery Block
 * Photo arrangement: one large featured image beside a grid of smaller images.
 * Authors can place the images in any rows/cells; every picture in the block
 * is collected in order. The first is featured, the rest form the thumbnail grid.
 * A caption (text in the same cell as an image) is kept under that image.
 */
import { createOptimizedPicture } from '../../scripts/aem.js';

function optimizeImages(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '1200' }]));
  });
}

/**
 * Collects each picture (or bare img) with an optional caption from its cell.
 * @param {Element} block
 * @returns {{ media: Element, caption: string }[]}
 */
function collectImages(block) {
  const items = [];
  block.querySelectorAll(':scope > div > div, :scope > div:not(:has(> div))').forEach((cell) => {
    const media = [...cell.querySelectorAll('picture, img:not(picture img)')];
    if (!media.length) return;
    const captionText = cell.textContent.trim();
    media.forEach((m, i) => {
      // a link wrapping the image is preserved
      const link = m.closest('a');
      items.push({
        media: link && cell.contains(link) ? link : m,
        caption: media.length === 1 && i === 0 ? captionText : '',
      });
    });
  });
  return items;
}

function buildFigure({ media, caption }, className) {
  const figure = document.createElement('figure');
  figure.className = className;
  figure.append(media);
  if (caption) {
    const figcaption = document.createElement('figcaption');
    figcaption.textContent = caption;
    figure.append(figcaption);
  }
  return figure;
}

export default function decorate(block) {
  const items = collectImages(block);
  if (!items.length) return; // nothing usable; leave authored content as-is

  const [first, ...rest] = items;
  const main = document.createElement('div');
  main.className = 'columns-gallery-main';
  main.append(buildFigure(first, 'columns-gallery-item'));

  const nodes = [main];
  if (rest.length) {
    const thumbs = document.createElement('div');
    thumbs.className = 'columns-gallery-thumbs';
    rest.forEach((item) => thumbs.append(buildFigure(item, 'columns-gallery-item')));
    nodes.push(thumbs);
  } else {
    block.classList.add('columns-gallery-single');
  }

  block.replaceChildren(...nodes);
  optimizeImages(block);
}
