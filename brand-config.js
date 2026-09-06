(function () {
  'use strict';

  const VERSION = window.EXCELLENCE_SYSTEM_VERSION || '20260906-95';
  const BRAND_NAME = 'Excellence System';
  const COMPANY_NAME = 'MP Consultoria';
  const HD_LOGO = `icon-512.png?v=${VERSION}`;

  window.EXCELLENCE_BRAND = Object.freeze({
    name: BRAND_NAME,
    company: COMPANY_NAME,
    logo: HD_LOGO,
    version: VERSION
  });

  const replacements = [
    [/Excellence System®/g, BRAND_NAME],
    [/Excellence System\s*®/g, BRAND_NAME],
    [/Senha provisória/g, 'Senha de acesso'],
    [/senha provisória/g, 'senha de acesso'],
    [/Gerar senha provisória/g, 'Gerar senha segura'],
    [/gerada\. Anote e envie ao responsável com segurança\./g, 'gerada. Anote e envie ao responsável com segurança.']
  ];

  function normalizeText(value) {
    let out = String(value ?? '');
    for (const [pattern, replacement] of replacements) out = out.replace(pattern, replacement);
    return out;
  }

  function improveLogo(img, baseDocument = document) {
    if (!(img instanceof (baseDocument.defaultView?.HTMLImageElement || HTMLImageElement))) return;

    const src = String(img.getAttribute('src') || '');
    const isBrandLogo = img.classList.contains('boot-logo') ||
      img.classList.contains('login-logo') ||
      img.classList.contains('sidebar-logo') ||
      img.classList.contains('tr93-logo') ||
      /(?:^|\/)logo\.png(?:\?|$)/i.test(src);

    if (!isBrandLogo) return;

    try {
      img.src = new URL(HD_LOGO, window.location.href).href;
    } catch (_) {
      img.src = HD_LOGO;
    }

    img.decoding = 'async';
    img.style.imageRendering = 'auto';
    img.style.objectFit = 'contain';
  }

  function normalizeElement(el, baseDocument = document) {
    if (!el || el.nodeType !== 1) return;

    for (const attr of ['title', 'aria-label', 'alt', 'placeholder']) {
      if (!el.hasAttribute?.(attr)) continue;
      const before = el.getAttribute(attr);
      const after = normalizeText(before);
      if (before !== after) el.setAttribute(attr, after);
    }

    if (el.tagName === 'IMG') improveLogo(el, baseDocument);
    el.querySelectorAll?.('img').forEach(img => improveLogo(img, baseDocument));
  }

  function normalizeTree(root, baseDocument = document) {
    if (!root) return;

    if (root.nodeType === 9) {
      const doc = root;
      try { doc.title = normalizeText(doc.title); } catch (_) {}
      normalizeTree(doc.documentElement, doc);
      return;
    }

    normalizeElement(root.nodeType === 1 ? root : null, baseDocument);

    const walker = baseDocument.createTreeWalker(
      root,
      (baseDocument.defaultView?.NodeFilter || NodeFilter).SHOW_TEXT
    );

    let node;
    while ((node = walker.nextNode())) {
      const parentTag = node.parentElement?.tagName;
      if (parentTag === 'SCRIPT' || parentTag === 'STYLE') continue;
      const before = node.nodeValue || '';
      const after = normalizeText(before);
      if (before !== after) node.nodeValue = after;
    }

    if (root.querySelectorAll) {
      root.querySelectorAll('*').forEach(el => normalizeElement(el, baseDocument));
    }
  }

  function normalizeFrame(frame) {
    if (!frame || frame.tagName !== 'IFRAME') return;

    const clean = () => {
      try {
        if (frame.contentDocument?.documentElement) normalizeTree(frame.contentDocument, frame.contentDocument);
      } catch (_) {}
    };

    frame.addEventListener('load', clean);
    [0, 25, 75, 150, 220].forEach(ms => setTimeout(clean, ms));
  }

  function normalizeDocument() {
    document.title = `${BRAND_NAME} | ${COMPANY_NAME}`;
    normalizeTree(document, document);
    document.querySelectorAll('iframe').forEach(normalizeFrame);
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1 && node.tagName === 'IFRAME') normalizeFrame(node);
        if (node.nodeType === 1) normalizeTree(node, document);
        if (node.nodeType === 3) {
          const before = node.nodeValue || '';
          const after = normalizeText(before);
          if (before !== after) node.nodeValue = after;
        }
      });
    }
  });

  normalizeDocument();
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('load', normalizeDocument);
  console.info(`${BRAND_NAME} • configuração central de marca ${VERSION} carregada.`);
})();
