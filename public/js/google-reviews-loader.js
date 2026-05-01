const GOOGLE_REVIEW_PLACE_ID = 'ChIJb7_tAZNXWEsRafrAml5YACU';
const REVIEWS_ENDPOINT = '/.netlify/functions/getReviews';
const REVIEWS_CACHE_KEY = 'nova-detailing-google-reviews-v1';
const REVIEWS_CACHE_TTL_MS = 30 * 60 * 1000;
const WIDGET_ROOT_SELECTOR = '.reviews-widget-section';

let reviewsRequest = null;
let widgetInitialized = false;
let widgetRendered = false;

function truncateText(text, maxLength = 300) {
  if (!text) return '';
  if (text.length <= maxLength) return text;

  let trimmed = text.slice(0, maxLength);
  trimmed = trimmed.slice(0, trimmed.lastIndexOf(' '));
  return `${trimmed}...`;
}

function readCachedReviews() {
  try {
    const raw = window.localStorage.getItem(REVIEWS_CACHE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp || !parsed?.data) {
      return null;
    }

    if (Date.now() - parsed.timestamp > REVIEWS_CACHE_TTL_MS) {
      window.localStorage.removeItem(REVIEWS_CACHE_KEY);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

function writeCachedReviews(data) {
  try {
    window.localStorage.setItem(
      REVIEWS_CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch {
    // Ignore storage failures.
  }
}

function renderStars(rating) {
  const elfsightStar = `
    <svg viewBox="0 0 14 14" fill="#FFD700" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
      <path d="M6.826 11.442L3.546 13.166c-.082.043-.175.063-.268.056a.5.5 0 01-.259-.094.5.5 0 01-.168-.234.5.5 0 01-.015-.273l.627-3.65a.5.5 0 00-.144-.443L.65 5.959a.5.5 0 01.276-.853l3.666-.533a.5.5 0 00.376-.274L6.61.978a.5.5 0 01.897 0l1.641 3.321a.5.5 0 00.376.274l3.666.533a.5.5 0 01.276.853l-2.653 2.585a.5.5 0 00-.144.443l.627 3.65a.5.5 0 01-.759.527L7.291 11.441a.5.5 0 00-.465 0z"/>
    </svg>
  `;

  return elfsightStar.repeat(Math.round(rating));
}

function extractUserId(authorUrl = '') {
  const match = authorUrl.match(/contrib\/(\d+)/);
  return match ? match[1] : '';
}

function updateSummaryHeader({ rating, totalReviews, url }) {
  const scoreEl = document.getElementById('score-value');
  if (scoreEl && typeof rating === 'number') {
    scoreEl.textContent = rating.toFixed(1);
    scoreEl.classList.remove('loading-score');
  }

  const summaryStars = document.getElementById('summary-stars');
  if (summaryStars && typeof rating === 'number') {
    summaryStars.innerHTML = renderStars(rating);
  }

  const totalReviewsEl = document.getElementById('total-reviews');
  if (totalReviewsEl && typeof totalReviews === 'number') {
    totalReviewsEl.textContent = `${totalReviews} reviews on `;
  }

  const reviewLink = document.getElementById('review-link');
  if (reviewLink && url) {
    reviewLink.href = url;
  }
}

function createSummaryMarkup(rating, totalReviews) {
  return `
    <div class="ai-summary-wrapper">
      <div class="review-wrapper">
        <div class="review-container">
          <div class="review-content">
            <div class="stars">${renderStars(rating)}</div>
            <ul class="ai-list" id="animated-ai-summary"></ul>
          </div>
          <svg class="tail" viewBox="0 0 19 13" xmlns="http://www.w3.org/2000/svg">
            <path d="M0.965704 0H10.3736L19 0C19 0 16.2331 5.15665 10.3736 8.99489C6.68171 11.4132 3.12703 12.3741 1.00222 12.7541C0.488597 12.8459 0.227225 12.1436 0.617463 11.7973C2.03909 10.5355 3.88298 8.3072 3.88294 5.23718C3.88287 0 0.965704 0 0.965704 0Z"></path>
          </svg>
        </div>
        <div class="review-author">
          <div class="review-profile">
            <img src="/assets/icons/ChatGPT-Logo.svg.png" alt="AI-generated summary" class="avatar" loading="eager" fetchpriority="high" decoding="async" width="40" height="40" />
            <div class="name-group">
              <span class="ai-author-name">AI-Generated Summary</span>
              <div class="review-date">Based on ${totalReviews} Google reviews</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createReviewCardMarkup(review) {
  const authorName = review.author_name || 'Google reviewer';
  const userId = extractUserId(review.author_url);
  const reviewLink = `https://www.google.com/maps/contrib/${userId}/place/${GOOGLE_REVIEW_PLACE_ID}`;
  const avatarLoading = review.index === 0 ? 'eager' : 'lazy';
  const avatarFetchPriority = review.index === 0 ? 'high' : 'auto';
  const profileLabel = `Read ${authorName}'s Google review`;

  return `
    <div class="review-wrapper">
      <div class="review-container">
        <div class="review-content">
          <div class="stars">${renderStars(review.rating)}</div>
          <p class="review-text">${truncateText(review.text) || '<em>(No comment)</em>'}</p>
        </div>
        <svg class="tail" viewBox="0 0 19 13" xmlns="http://www.w3.org/2000/svg">
          <path d="M0.965704 0H10.3736L19 0C19 0 16.2331 5.15665 10.3736 8.99489C6.68171 11.4132 3.12703 12.3741 1.00222 12.7541C0.488597 12.8459 0.227225 12.1436 0.617463 11.7973C2.03909 10.5355 3.88298 8.3072 3.88294 5.23718C3.88287 0 0.965704 0 0.965704 0Z"></path>
        </svg>
      </div>
      <div class="review-author">
        <a href="${reviewLink}" target="_blank" rel="noopener noreferrer" class="review-profile" aria-label="${profileLabel}">
          <img src="${review.profile_photo_url}" alt="${authorName}" class="avatar" loading="${avatarLoading}" fetchpriority="${avatarFetchPriority}" decoding="async" width="36" height="36" referrerpolicy="no-referrer">
        </a>
        <div class="name-group">
          <a href="${reviewLink}" target="_blank" rel="noopener noreferrer" class="review-profile" aria-label="${profileLabel}">
            <span class="author-name">${authorName}</span>
            <div class="author-badge">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" class="verified-badge-icon" width="16" height="16">
                <path fill="#197BFF" d="M6.757.236a.35.35 0 0 1 .486 0l1.106 1.07a.35.35 0 0 0 .329.089l1.493-.375a.35.35 0 0 1 .422.244l.422 1.48a.35.35 0 0 0 .24.24l1.481.423a.35.35 0 0 1 .244.422l-.375 1.493a.35.35 0 0 0 .088.329l1.071 1.106a.35.35 0 0 1 0 .486l-1.07 1.106a.35.35 0 0 0-.089.329l.375 1.493a.35.35 0 0 1-.244.422l-1.48.422a.35.35 0 0 0-.24.24l-.423 1.481a.35.35 0 0 1-.422.244l-1.493-.375a.35.35 0 0 0-.329.088l-1.106 1.071a.35.35 0 0 1-.486 0l-1.106-1.07a.35.35 0 0 0-.329-.089l-1.493.375a.35.35 0 0 1-.422-.244l-.422-1.48a.35.35 0 0 0-.24-.24l-1.481-.423a.35.35 0 0 1-.244-.422l.375-1.493a.35.35 0 0 0-.088-.329L.236 7.243a.35.35 0 0 1 0-.486l1.07-1.106a.35.35 0 0 0 .089-.329L1.02 3.829a.35.35 0 0 1 .244-.422l1.48-.422a.35.35 0 0 0 .24-.24l.423-1.481a.35.35 0 0 1 .422-.244l1.493.375a.35.35 0 0 0 .329-.088L6.757.236Z"/>
                <path fill="#fff" fill-rule="evenodd" d="M9.065 4.85a.644.644 0 0 1 .899 0 .615.615 0 0 1 .053.823l-.053.059L6.48 9.15a.645.645 0 0 1-.84.052l-.06-.052-1.66-1.527a.616.616 0 0 1 0-.882.645.645 0 0 1 .84-.052l.06.052 1.21 1.086 3.034-2.978Z" clip-rule="evenodd"/>
              </svg>
            </div>
          </a>
          <div class="date-container">
            <div class="review-date">${review.relative_time_description}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSummaryBullets(bullets) {
  const list = document.getElementById('animated-ai-summary');
  if (!list) {
    return;
  }

  list.innerHTML = '';

  (bullets || []).forEach((text, index) => {
    const item = document.createElement('li');
    item.textContent = text;
    item.style.setProperty('--review-delay', `${index}`);
    list.appendChild(item);
  });

  revealSummaryBulletsWhenVisible(list);
}

function revealSummaryBulletsWhenVisible(list) {
  const reveal = () => {
    requestAnimationFrame(() => {
      list.classList.add('is-visible');
    });
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    reveal();
    return;
  }

  const summaryCard = list.closest('.ai-summary-wrapper');
  if (!summaryCard || typeof window.IntersectionObserver !== 'function') {
    window.setTimeout(reveal, 120);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        observer.unobserve(entry.target);
        reveal();
      });
    },
    {
      threshold: 0.35,
      rootMargin: '0px 0px -8% 0px',
    }
  );

  observer.observe(summaryCard);
}

function renderReviewsError() {
  const container = document.getElementById('google-reviews');
  if (!container || widgetRendered) {
    return;
  }

  container.innerHTML = `
    <div class="reviews-load-error">
      Reviews are taking a little longer than usual to load right now.
    </div>
  `;
}

function renderGoogleReviewsWidget(data) {
  const container = document.getElementById('google-reviews');
  if (!container || widgetRendered) {
    return;
  }

  const reviews = (Array.isArray(data.reviews) ? data.reviews : []).map((review, index) => ({
    ...review,
    index,
  }));
  const summaryBullets = Array.isArray(data.summaryBullets) ? data.summaryBullets : [];

  updateSummaryHeader(data);

  container.innerHTML =
    createSummaryMarkup(data.rating, data.totalReviews) +
    reviews.map(createReviewCardMarkup).join('');

  widgetRendered = true;
  renderSummaryBullets(summaryBullets);
}

function fetchReviewsData() {
  const cached = readCachedReviews();
  if (cached) {
    return Promise.resolve(cached);
  }

  if (reviewsRequest) {
    return reviewsRequest;
  }

  reviewsRequest = fetch(REVIEWS_ENDPOINT, {
    headers: {
      Accept: 'application/json',
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      return response.json();
    })
    .then((data) => {
      writeCachedReviews(data);
      return data;
    })
    .finally(() => {
      reviewsRequest = null;
    });

  return reviewsRequest;
}

function queueBackgroundFetch() {
  const idleFetch = () => {
    fetchReviewsData().catch(() => {
      // We'll show the error state only if the widget is actually viewed.
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(idleFetch, { timeout: 1500 });
    return;
  }

  window.setTimeout(idleFetch, 800);
}

function revealReviewsWhenNearViewport(section) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        observer.unobserve(entry.target);
        fetchReviewsData()
          .then((data) => {
            window.requestAnimationFrame(() => {
              renderGoogleReviewsWidget(data);
            });
          })
          .catch((error) => {
            console.error('Failed to load reviews:', error);
            renderReviewsError();
          });
      });
    },
    {
      rootMargin: '500px 0px',
      threshold: 0.05,
    }
  );

  observer.observe(section);
}

function loadGoogleReviewsWidget() {
  if (widgetInitialized) {
    return;
  }

  const section = document.querySelector(WIDGET_ROOT_SELECTOR);
  if (!section) {
    return;
  }

  widgetInitialized = true;
  queueBackgroundFetch();
  revealReviewsWhenNearViewport(section);
}

window.loadGoogleReviewsWidget = loadGoogleReviewsWidget;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadGoogleReviewsWidget();
  }, { once: true });
} else {
  loadGoogleReviewsWidget();
}
