const COVER_URL = 'https://pbs.twimg.com/media/G_rR-m6WEAAEAwj?format=jpg&name=small';

export function initCover(container) {
  const img = document.createElement('img');
  img.src = COVER_URL;
  img.alt = 'Book cover';
  container.appendChild(img);
}
