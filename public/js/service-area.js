(function () {
  const checkerCopy = window.NOVA_SERVICE_AREA_CONFIG?.checkerCopy || {};
  const checkerSection = document.getElementById('service-area-checker');
  const jumpToCheckerButton = document.getElementById('jump-to-checker');
  const checkerForm = document.getElementById('service-area-form');
  const addressInput = document.getElementById('service-area-address');
  const suggestionsEl = document.getElementById('service-area-suggestions');
  const suggestionSourceEl = document.getElementById('service-area-suggestion-source');
  const submitButton = document.getElementById('service-area-submit');
  const feedbackEl = document.getElementById('service-area-feedback');
  const resultCard = document.getElementById('service-area-result');
  const resultBody = document.getElementById('service-area-result-body');
  const zoneVisualHeading = document.getElementById('zone-visual-heading');
  const zoneVisualText = document.getElementById('zone-visual-text');
  const zoneVisualPill = document.getElementById('zone-visual-pill');
  const mapEl = document.getElementById('service-area-map');
  const revealItems = document.querySelectorAll('.service-area-reveal:not(.is-visible)');

  if (!checkerForm || !addressInput || !resultCard || !resultBody) {
    return;
  }

  const HOME_BASE = {
    lat: 45.0779,
    lng: -64.496,
  };
  const LEAFLET_SCRIPT_SRC = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  const CORE_RADIUS_METERS = 15000;
  const REGULAR_RADIUS_METERS = 35000;
  const EXTENDED_RADIUS_METERS = 55000;
  const MAP_PADDING = [28, 28];

  let currentSuggestions = [];
  let activeSuggestionIndex = -1;
  let selectedSuggestion = null;
  let suggestionDebounceTimer = null;
  let suggestionHideTimer = null;
  let suggestionRequestController = null;
  let autocompleteSessionToken = window.crypto?.randomUUID?.() || `${Date.now()}-service-area`;
  let serviceMap = null;
  let coreCircle = null;
  let regularCircle = null;
  let extendedCircle = null;
  let homeMarker = null;
  let checkedMarker = null;
  let leafletReadyPromise = null;
  let lastMapPayload = null;

  const escapeHtml = (value = '') =>
    String(value).replace(/[&<>"']/g, (character) => {
      const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };

      return entities[character] || character;
    });

  const normalizeAddress = (value = '') =>
    String(value).toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();

  const formatChatMessage = (template, address) =>
    template.replace('[address]', address || 'my address');

  const setFeedback = (message = '', tone = 'neutral') => {
    if (!feedbackEl) {
      return;
    }

    if (!message) {
      feedbackEl.hidden = true;
      feedbackEl.textContent = '';
      feedbackEl.dataset.tone = 'neutral';
      return;
    }

    feedbackEl.hidden = false;
    feedbackEl.dataset.tone = tone;
    feedbackEl.textContent = message;
  };

  const ensureLeaflet = () => {
    if (window.L) {
      return Promise.resolve(window.L);
    }

    if (leafletReadyPromise) {
      return leafletReadyPromise;
    }

    leafletReadyPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-service-area-leaflet]');

      if (existingScript) {
        existingScript.addEventListener(
          'load',
          () => resolve(window.L),
          { once: true }
        );
        existingScript.addEventListener(
          'error',
          () => reject(new Error('Leaflet failed to load.')),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.src = LEAFLET_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.dataset.serviceAreaLeaflet = 'true';
      script.onload = () => resolve(window.L);
      script.onerror = () => reject(new Error('Leaflet failed to load.'));
      document.head.appendChild(script);
    });

    return leafletReadyPromise;
  };

  const buildButtonsMarkup = (ctas, address) =>
    ctas
      .map(
        (cta) => `
          <button
            type="button"
            class="service-area-button ${
              cta.variant === 'primary'
                ? 'service-area-button-primary'
                : 'service-area-button-secondary'
            } open-chat"
            data-chat-message="${escapeHtml(formatChatMessage(cta.messageTemplate, address))}"
          >
            ${escapeHtml(cta.label)}
          </button>
        `
      )
      .join('');

  const renderResult = (state, payload) => {
    const config = checkerCopy[state] || checkerCopy.error;
    const formattedAddress = payload?.formattedAddress || payload?.inputAddress || '';
    const distanceLine = payload?.distanceKm
      ? `<p class="service-area-result-meta">${escapeHtml(
          formattedAddress
        )}<br />Approx. ${payload.distanceKm.toFixed(1)} km from Kentville</p>`
      : '';

    resultCard.dataset.zone = payload?.visualZone || payload?.zone || state;
    resultBody.innerHTML = `
      <h3>${escapeHtml(config.title)}</h3>
      <p>${escapeHtml(config.message)}</p>
      ${distanceLine}
      <div class="service-area-result-tags">
        ${config.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}
      </div>
      <div class="service-area-cta-row service-area-cta-row-compact">
        ${buildButtonsMarkup(config.ctas, formattedAddress)}
      </div>
    `;
  };

  const hideSuggestions = (clearList = false) => {
    if (!suggestionsEl) {
      return;
    }

    suggestionsEl.hidden = true;
    suggestionsEl.innerHTML = '';
    suggestionsEl.removeAttribute('data-loading');
    addressInput.setAttribute('aria-expanded', 'false');
    addressInput.removeAttribute('aria-activedescendant');

    if (suggestionSourceEl) {
      suggestionSourceEl.hidden = true;
    }

    activeSuggestionIndex = -1;

    if (clearList) {
      currentSuggestions = [];
    }
  };

  const setActiveSuggestion = (index) => {
    if (!suggestionsEl) {
      return;
    }

    const options = suggestionsEl.querySelectorAll('.service-area-suggestion');

    options.forEach((option, optionIndex) => {
      const isActive = optionIndex === index;
      option.classList.toggle('is-active', isActive);
      option.setAttribute('aria-selected', isActive ? 'true' : 'false');

      if (isActive) {
        addressInput.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
      }
    });

    activeSuggestionIndex = index;
  };

  const renderSuggestions = (payload) => {
    if (!suggestionsEl) {
      return;
    }

    currentSuggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
    activeSuggestionIndex = -1;

    if (!currentSuggestions.length) {
      hideSuggestions(false);
      return;
    }

    suggestionsEl.innerHTML = currentSuggestions
      .map(
        (suggestion, index) => `
          <button
            type="button"
            id="service-area-suggestion-${index}"
            class="service-area-suggestion"
            role="option"
            aria-selected="false"
            data-index="${index}"
          >
            <span class="service-area-suggestion-main">${escapeHtml(
              suggestion.mainText || suggestion.description
            )}</span>
            <span class="service-area-suggestion-secondary">${escapeHtml(
              suggestion.secondaryText || ''
            )}</span>
          </button>
        `
      )
      .join('');

    suggestionsEl.hidden = false;
    addressInput.setAttribute('aria-expanded', 'true');

    if (suggestionSourceEl) {
      suggestionSourceEl.hidden = false;
      suggestionSourceEl.textContent =
        payload?.source === 'google'
          ? 'Address suggestions powered by Google'
          : 'Address suggestions';
    }
  };

  const chooseSuggestion = (index) => {
    const choice = currentSuggestions[index];

    if (!choice) {
      return;
    }

    selectedSuggestion = choice;
    addressInput.value = choice.description;
    autocompleteSessionToken = window.crypto?.randomUUID?.() || `${Date.now()}-service-area`;
    hideSuggestions(false);
  };

  const getAutofillCandidate = (address) => {
    if (!currentSuggestions.length) {
      return null;
    }

    const normalizedAddress = normalizeAddress(address);
    const exactMatch = currentSuggestions.find(
      (item) => normalizeAddress(item.description) === normalizedAddress
    );

    if (exactMatch) {
      return exactMatch;
    }

    const firstSuggestion = currentSuggestions[0];
    const firstDescription = normalizeAddress(firstSuggestion.description);
    const firstMain = normalizeAddress(firstSuggestion.mainText || '');

    if (
      firstDescription.startsWith(normalizedAddress) ||
      firstMain.startsWith(normalizedAddress)
    ) {
      return firstSuggestion;
    }

    return null;
  };

  const fetchSuggestions = async (query) => {
    if (!suggestionsEl) {
      return;
    }

    if (suggestionRequestController) {
      suggestionRequestController.abort();
    }

    suggestionRequestController = new AbortController();
    suggestionsEl.dataset.loading = 'true';

    try {
      const response = await fetch(
        `/.netlify/functions/getAddressSuggestions?input=${encodeURIComponent(
          query
        )}&sessionToken=${encodeURIComponent(autocompleteSessionToken)}`,
        {
          signal: suggestionRequestController.signal,
        }
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Could not load address suggestions.');
      }

      if (normalizeAddress(addressInput.value) !== normalizeAddress(query)) {
        return;
      }

      renderSuggestions(payload);
    } catch (error) {
      if (error.name !== 'AbortError') {
        hideSuggestions(true);
      }
    } finally {
      suggestionsEl.removeAttribute('data-loading');
    }
  };

  const initMap = () => {
    if (!mapEl || serviceMap || !window.L) {
      return;
    }

    serviceMap = window.L.map(mapEl, {
      scrollWheelZoom: false,
      dragging: true,
      zoomControl: true,
    });

    mapEl.addEventListener('mouseenter', () => {
      serviceMap.scrollWheelZoom.enable();
    });

    mapEl.addEventListener('mouseleave', () => {
      serviceMap.scrollWheelZoom.disable();
    });

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(serviceMap);

    extendedCircle = window.L.circle([HOME_BASE.lat, HOME_BASE.lng], {
      radius: EXTENDED_RADIUS_METERS,
      color: '#ff9f1c',
      fillColor: '#ff9f1c',
      fillOpacity: 0.08,
      weight: 2.8,
    }).addTo(serviceMap);

    regularCircle = window.L.circle([HOME_BASE.lat, HOME_BASE.lng], {
      radius: REGULAR_RADIUS_METERS,
      color: '#4d82ff',
      fillColor: '#5a96ff',
      fillOpacity: 0.11,
      weight: 2.5,
    }).addTo(serviceMap);

    coreCircle = window.L.circle([HOME_BASE.lat, HOME_BASE.lng], {
      radius: CORE_RADIUS_METERS,
      color: '#ff7b7b',
      fillColor: '#ff5959',
      fillOpacity: 0.2,
      weight: 2.4,
    }).addTo(serviceMap);

    homeMarker = window.L.circleMarker([HOME_BASE.lat, HOME_BASE.lng], {
      radius: 8,
      color: '#ffffff',
      weight: 3,
      fillColor: '#d62828',
      fillOpacity: 1,
    }).addTo(serviceMap);

    homeMarker.bindTooltip('Kentville base', {
      permanent: true,
      direction: 'top',
      offset: [0, -8],
      className: 'service-area-map-tooltip service-area-map-tooltip-home',
    });

    checkedMarker = window.L.circleMarker([HOME_BASE.lat, HOME_BASE.lng], {
      radius: 8,
      color: '#ffffff',
      weight: 3,
      fillColor: '#58d5ff',
      fillOpacity: 1,
    });

    serviceMap.setView([HOME_BASE.lat, HOME_BASE.lng], 9);

    window.setTimeout(() => serviceMap?.invalidateSize(), 80);
  };

  const resetMap = () => {
    initMap();

    if (!serviceMap) {
      return;
    }

    if (checkedMarker && serviceMap.hasLayer(checkedMarker)) {
      serviceMap.removeLayer(checkedMarker);
    }

    serviceMap.setView([HOME_BASE.lat, HOME_BASE.lng], 9);
  };

  const syncMap = (payload) => {
    lastMapPayload = payload || null;

    if (!mapEl) {
      return;
    }

    ensureLeaflet()
      .then(() => {
        if (lastMapPayload) {
          updateMap(lastMapPayload);
        } else {
          resetMap();
        }
      })
      .catch((error) => {
        mapEl.dataset.mapState = 'error';
        mapEl.dataset.mapError = error?.message || 'Map failed to load';
        console.error('Service area map failed:', error);
      });
  };

  const updateMap = (payload) => {
    initMap();

    if (!serviceMap || !checkedMarker || !coreCircle || !regularCircle || !extendedCircle) {
      return;
    }

    if (!payload) {
      resetMap();
      return;
    }

    const checkedLatLng = window.L.latLng(payload.latitude, payload.longitude);
    checkedMarker.setLatLng(checkedLatLng);
    checkedMarker.setStyle({
      fillColor: payload.zone === 'outside' ? '#ff8d8d' : '#58d5ff',
    });
    checkedMarker.bindTooltip(payload.formattedAddress.split(',').slice(0, 2).join(', '), {
      direction: 'top',
      offset: [0, -8],
      className: 'service-area-map-tooltip',
    });

    if (!serviceMap.hasLayer(checkedMarker)) {
      checkedMarker.addTo(serviceMap);
    }

    serviceMap.flyTo(checkedLatLng, 13, {
      duration: 0.9,
    });
  };

  const updateZoneVisual = (payload) => {
    if (!zoneVisualHeading || !zoneVisualText || !zoneVisualPill) {
      syncMap(payload);
      return;
    }

    if (!payload) {
      zoneVisualHeading.textContent = 'Kentville base, regular area, and extended area';
      zoneVisualText.textContent =
        'The map shows Kentville as our base, the regular 40 km service area, and the farther extended area we still consider for the right jobs.';
      zoneVisualPill.textContent = 'Service area guide';
      zoneVisualPill.dataset.zone = 'idle';
      syncMap(null);
      return;
    }

    const visualZone = payload.visualZone || payload.zone || 'regular';
    zoneVisualPill.dataset.zone = payload.zone || visualZone;

    if (visualZone === 'core') {
      zoneVisualHeading.textContent = 'Inside the Kentville home-base zone';
      zoneVisualText.textContent =
        'This address looks close to Kentville and should be one of the easiest areas for us to schedule.';
      zoneVisualPill.textContent = 'Core / regular area';
    } else if (payload.zone === 'regular') {
      zoneVisualHeading.textContent = 'Inside the regular mobile area';
      zoneVisualText.textContent =
        'This address looks like part of our regular mobile service area, where standard detailing appointments fit most easily.';
      zoneVisualPill.textContent = 'Regular area';
    } else if (payload.zone === 'extended') {
      zoneVisualHeading.textContent = 'Inside the extended quote area';
      zoneVisualText.textContent =
        'This address is outside our regular area, but it may still be possible depending on distance, schedule, service type, and vehicle count.';
      zoneVisualPill.textContent = 'Extended quote area';
    } else {
      zoneVisualHeading.textContent = 'Outside the usual mobile range';
      zoneVisualText.textContent =
        'This address is outside our normal mobile range, but bigger jobs may still be possible if the service and vehicle count make the trip worthwhile.';
      zoneVisualPill.textContent = 'Custom quote required';
    }

    syncMap(payload);
  };

  const setLoadingState = (isLoading) => {
    if (!submitButton) {
      return;
    }

    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? 'Checking...' : 'Check Address';
    resultCard.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  };

  const checkAddress = async (address, placeId = '') => {
    setLoadingState(true);
    hideSuggestions(false);

    try {
      const response = await fetch('/.netlify/functions/checkServiceArea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, placeId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'We could not check that address right now.');
      }

      renderResult(payload.zone, payload);
      updateZoneVisual(payload);
      setFeedback(`Checked: ${payload.formattedAddress}`, 'success');
    } catch (error) {
      renderResult('error');
      updateZoneVisual(null);
      setFeedback(error.message || 'We could not check that address right now.', 'error');
    } finally {
      setLoadingState(false);
    }
  };

  if (typeof window.IntersectionObserver === 'function' && revealItems.length) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.14,
        rootMargin: '0px 0px -8% 0px',
      }
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  if (jumpToCheckerButton && checkerSection) {
    jumpToCheckerButton.addEventListener('click', () => {
      checkerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => addressInput.focus(), 450);
    });
  }

  if (suggestionsEl) {
    suggestionsEl.addEventListener('click', (event) => {
      const suggestionButton = event.target.closest('.service-area-suggestion');

      if (!(suggestionButton instanceof HTMLButtonElement)) {
        return;
      }

      const index = Number(suggestionButton.dataset.index || '-1');

      if (index >= 0) {
        chooseSuggestion(index);
      }
    });
  }

  addressInput.addEventListener('input', () => {
    const value = addressInput.value.trim();
    selectedSuggestion = null;
    setFeedback('');

    if (suggestionHideTimer) {
      window.clearTimeout(suggestionHideTimer);
    }

    if (suggestionDebounceTimer) {
      window.clearTimeout(suggestionDebounceTimer);
    }

    if (value.length < 4) {
      hideSuggestions(true);
      return;
    }

    suggestionDebounceTimer = window.setTimeout(() => {
      fetchSuggestions(value);
    }, 220);
  });

  addressInput.addEventListener('focus', () => {
    if (suggestionHideTimer) {
      window.clearTimeout(suggestionHideTimer);
    }

    if (currentSuggestions.length) {
      renderSuggestions({
        suggestions: currentSuggestions,
        source: 'google',
      });
    }
  });

  addressInput.addEventListener('blur', () => {
    suggestionHideTimer = window.setTimeout(() => {
      hideSuggestions(false);
    }, 140);
  });

  addressInput.addEventListener('keydown', (event) => {
    if (!currentSuggestions.length || suggestionsEl?.hidden) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex =
        activeSuggestionIndex < currentSuggestions.length - 1 ? activeSuggestionIndex + 1 : 0;
      setActiveSuggestion(nextIndex);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const previousIndex =
        activeSuggestionIndex > 0 ? activeSuggestionIndex - 1 : currentSuggestions.length - 1;
      setActiveSuggestion(previousIndex);
    } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault();
      chooseSuggestion(activeSuggestionIndex);
    } else if (event.key === 'Escape') {
      hideSuggestions(false);
    }
  });

  checkerForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const address = addressInput.value.trim();

    if (!address) {
      setFeedback('Please enter an address to check.', 'error');
      addressInput.focus();
      return;
    }

    const resolvedSuggestion = selectedSuggestion || getAutofillCandidate(address);
    const addressToCheck = resolvedSuggestion?.description || address;
    const placeId = resolvedSuggestion?.placeId || '';

    if (resolvedSuggestion && !selectedSuggestion) {
      setFeedback(`Checking closest match: ${resolvedSuggestion.description}`, 'success');
    } else {
      setFeedback('');
    }

    if (resolvedSuggestion) {
      selectedSuggestion = resolvedSuggestion;
      addressInput.value = resolvedSuggestion.description;
    }

    checkAddress(addressToCheck, placeId);
  });

  updateZoneVisual(null);
})();
