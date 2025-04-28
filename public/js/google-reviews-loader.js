function loadGoogleReviewsWidget() {
    const PLACE_ID = "ChIJb7_tAZNXWEsRafrAml5YACU";
    console.log("🔥 Google Reviews widget script running");
  
    fetch('/.netlify/functions/getReviews')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json()
      })
      .then(data => {
        console.log("✅ Parsed JSON data:", data);
  
        const { rating, totalReviews, url, reviews, summaryBullets } = data;
  
        const scoreEl = document.getElementById('score-value');
        scoreEl.textContent = rating.toFixed(1);
        scoreEl.classList.remove('loading-score'); // 👈 remove the loading shimmer
      
        document.getElementById('summary-stars').innerHTML = renderStars(rating);
        document.getElementById('total-reviews').textContent = `${totalReviews} reviews on `;
        document.getElementById('review-link').href = url;
  
        // Inject AI Summary + Review Cards
        const container = document.getElementById('google-reviews');
        container.innerHTML = `
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
                  <img src="/assets/icons/ChatGPT-Logo.svg.png" alt="AI" class="avatar" />
                  <div class="name-group">
                    <span class="ai-author-name">AI-Generated Summary</span>
                    <div class="review-date">Based on ${totalReviews} Google reviews</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ` + (reviews || []).map(r => {
          const userId = extractUserId(r.author_url);
          const reviewLink = `https://www.google.com/maps/contrib/${userId}/place/${PLACE_ID}`;
          return `
          <div class="review-wrapper">
            <div class="review-container">
              <div class="review-content">
                <div class="stars">${renderStars(r.rating)}</div>
                <p class="review-text">${r.text || '<em>(No comment)</em>'}</p>
              </div>
              <svg class="tail" viewBox="0 0 19 13" xmlns="http://www.w3.org/2000/svg">
                <path d="M0.965704 0H10.3736L19 0C19 0 16.2331 5.15665 10.3736 8.99489C6.68171 11.4132 3.12703 12.3741 1.00222 12.7541C0.488597 12.8459 0.227225 12.1436 0.617463 11.7973C2.03909 10.5355 3.88298 8.3072 3.88294 5.23718C3.88287 0 0.965704 0 0.965704 0Z"></path>
              </svg>
            </div>
            <div class="review-author">
              <a href="${reviewLink}" target="_blank" class="review-profile">
                <img src="${r.profile_photo_url}" alt="${r.author_name}" class="avatar">
              </a>
              <div class="name-group">
                <a href="${reviewLink}" target="_blank" class="review-profile">
                  <span class="author-name">${r.author_name}</span>
                  <div class="author-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" class="verified-badge-icon" width="16" height="16">
                      <path fill="#197BFF" d="M6.757.236a.35.35 0 0 1 .486 0l1.106 1.07a.35.35 0 0 0 .329.089l1.493-.375a.35.35 0 0 1 .422.244l.422 1.48a.35.35 0 0 0 .24.24l1.481.423a.35.35 0 0 1 .244.422l-.375 1.493a.35.35 0 0 0 .088.329l1.071 1.106a.35.35 0 0 1 0 .486l-1.07 1.106a.35.35 0 0 0-.089.329l.375 1.493a.35.35 0 0 1-.244.422l-1.48.422a.35.35 0 0 0-.24.24l-.423 1.481a.35.35 0 0 1-.422.244l-1.493-.375a.35.35 0 0 0-.329.088l-1.106 1.071a.35.35 0 0 1-.486 0l-1.106-1.07a.35.35 0 0 0-.329-.089l-1.493.375a.35.35 0 0 1-.422-.244l-.422-1.48a.35.35 0 0 0-.24-.24l-1.481-.423a.35.35 0 0 1-.244-.422l.375-1.493a.35.35 0 0 0-.088-.329L.236 7.243a.35.35 0 0 1 0-.486l1.07-1.106a.35.35 0 0 0 .089-.329L1.02 3.829a.35.35 0 0 1 .244-.422l1.48-.422a.35.35 0 0 0 .24-.24l.423-1.481a.35.35 0 0 1 .422-.244l1.493.375a.35.35 0 0 0 .329-.088L6.757.236Z"/>
                      <path fill="#fff" fill-rule="evenodd" d="M9.065 4.85a.644.644 0 0 1 .899 0 .615.615 0 0 1 .053.823l-.053.059L6.48 9.15a.645.645 0 0 1-.84.052l-.06-.052-1.66-1.527a.616.616 0 0 1 0-.882.645.645 0 0 1 .84-.052l.06.052 1.21 1.086 3.034-2.978Z" clip-rule="evenodd"/>
                    </svg>
                  </div>
                </a>
                <div class="date-container">
                  <div class="review-date">${r.relative_time_description}</div>
                </div>
              </div>
            </div>
          </div>
        `;        
        }).join('');
        observeAndType(summaryBullets);
      })
      .catch(err => {
        console.error("❌ Failed to load reviews:", err);
      });
  }

  function extractUserId(authorUrl) {
    const match = authorUrl.match(/contrib\/(\d+)/);
    return match ? match[1] : '';
  }
  
  function renderStars(rating) {
    const elfsightStar = `
      <svg viewBox="0 0 14 14" fill="#FFD700" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
        <path d="M6.826 11.442L3.546 13.166c-.082.043-.175.063-.268.056a.5.5 0 01-.259-.094.5.5 0 01-.168-.234.5.5 0 01-.015-.273l.627-3.65a.5.5 0 00-.144-.443L.65 5.959a.5.5 0 01.276-.853l3.666-.533a.5.5 0 00.376-.274L6.61.978a.5.5 0 01.897 0l1.641 3.321a.5.5 0 00.376.274l3.666.533a.5.5 0 01.276.853l-2.653 2.585a.5.5 0 00-.144.443l.627 3.65a.5.5 0 01-.759.527L7.291 11.441a.5.5 0 00-.465 0z"/>
      </svg>
    `;
    return elfsightStar.repeat(Math.round(rating));
  }
  
  async function typeSummaryBullets(bullets, containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
  
    container.innerHTML = ''; // clear any placeholder
  
    for (const text of bullets) {
      const li = document.createElement('li');
      li.classList.add('typing');
      container.appendChild(li);
  
      for (let i = 0; i <= text.length; i++) {
        li.textContent = text.slice(0, i);
        await new Promise(r => setTimeout(r, 25));
      }
  
      li.classList.remove('typing');
      await new Promise(r => setTimeout(r, 150));
    }

  }
  function observeAndType(bullets) {
    const target = document.querySelector('.review-wrapper'); // This is your AI summary wrapper
    if (!target) return;
  
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          typeSummaryBullets(bullets, '#animated-ai-summary');
          observer.unobserve(entry.target); // only trigger once
        }
      });
    }, {
      threshold: 0.4,
    });
  
    observer.observe(target);
  }
  
  