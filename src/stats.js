(() => {
  try {
    if (!/^https?:$/.test(location.protocol)) return;
    const host = (location.hostname || '').toLowerCase();
    if (!host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return;
    const payload = JSON.stringify({
      path: location.pathname || '/',
      ref: document.referrer || '',
      scheme: (document.querySelector('meta[name="color-scheme"]')?.content || '').toLowerCase(),
      vw: window.innerWidth || 0
    });
    const url = '/api/collect';
    if (navigator.sendBeacon?.(url, new Blob([payload], { type: 'text/plain' }))) return;
    fetch(url, {
      method: 'POST',
      keepalive: true,
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain' },
      body: payload
    }).catch(() => {});
  } catch (e) {}
})();
