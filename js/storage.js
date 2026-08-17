(function () {
  const STORAGE_KEY = 'murterBetina.links.v1';

  function safeParse(value) {
    try {
      return value ? JSON.parse(value) : {};
    } catch (error) {
      return {};
    }
  }

  function normalizeLinkRecord(value) {
    if (!value || typeof value !== 'object') {
      return { catastro: '', kmz: '' };
    }
    return {
      catastro: typeof value.catastro === 'string' ? value.catastro.trim() : '',
      kmz: typeof value.kmz === 'string' ? value.kmz.trim() : ''
    };
  }

  function readBaseLinks() {
    return (window.LINKS_PARCELAS && typeof window.LINKS_PARCELAS === 'object') ? window.LINKS_PARCELAS : {};
  }

  function readLocalLinks() {
    if (!window.localStorage) {
      return {};
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = safeParse(raw);
    const result = {};

    Object.keys(parsed || {}).forEach(function (key) {
      result[key] = normalizeLinkRecord(parsed[key]);
    });

    return result;
  }

  function getEffectiveLinks() {
    const base = readBaseLinks();
    const local = readLocalLinks();
    const merged = {};

    Object.keys(base).forEach(function (key) {
      merged[key] = normalizeLinkRecord(base[key]);
    });

    Object.keys(local).forEach(function (key) {
      const localRecord = normalizeLinkRecord(local[key]);
      const baseRecord = merged[key] || { catastro: '', kmz: '' };
      merged[key] = {
        catastro: localRecord.catastro || baseRecord.catastro || '',
        kmz: localRecord.kmz || baseRecord.kmz || ''
      };
    });

    return merged;
  }

  function saveLocalLinks(links) {
    if (!window.localStorage) {
      return false;
    }

    const normalized = {};
    Object.keys(links || {}).forEach(function (key) {
      normalized[key] = normalizeLinkRecord(links[key]);
    });

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return true;
  }

  function clearLocalLinks() {
    if (window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  function localOverridesExist() {
    const local = readLocalLinks();
    return Object.keys(local).length > 0;
  }

  window.MurterStorage = {
    STORAGE_KEY: STORAGE_KEY,
    readBaseLinks: readBaseLinks,
    readLocalLinks: readLocalLinks,
    getEffectiveLinks: getEffectiveLinks,
    saveLocalLinks: saveLocalLinks,
    clearLocalLinks: clearLocalLinks,
    localOverridesExist: localOverridesExist
  };
})();
