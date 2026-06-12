(() => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/crm-sw.js', {
        scope: '/crm',
        updateViaCache: 'none',
      })
      .catch((error) => {
        console.warn('Nova CRM app registration failed.', error);
      });
  });
})();
