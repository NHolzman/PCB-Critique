// Ensure site-header is display: block
if (!document.querySelector('style[data-site-header-css]')) {
    const style = document.createElement('style');
    style.setAttribute('data-site-header-css', '');
    style.textContent = 'site-header { display: block; }';
    document.head.appendChild(style);
}

class SiteHeader extends HTMLElement {
    static getHTML(root = '') {
        return `
            <header>
                <h1>The website to critique PCBs</h1>
                <p>Associated with the pro nuclear energy committee &bull; Established in 2026</p>
            </header>
            <nav>
                <a href="${root}">[Home]</a>
                <a href="${root}documentation/">[Documentation]</a>
                <a href="${root}critiques/">[Critiques]</a>
                <a href="${root}contact/">[Contact]</a>
                <a href="https://pronucleaire.org" target="_blank" rel="noopener noreferrer">[Comité pro énergie nucléaire ↗]</a>
            </nav>
        `;
    }

    connectedCallback() {
        let root = this.getAttribute('root');
        if (root === null) {
            const script = document.querySelector('script[src*="header.js"]');
            if (script) {
                const src = script.getAttribute('src');
                root = src.substring(0, src.lastIndexOf('header.js'));
            } else {
                root = '';
            }
        }
        this.innerHTML = SiteHeader.getHTML(root);
    }
}

if (!customElements.get('site-header')) {
    customElements.define('site-header', SiteHeader);
}

/* ==========================================================================
   McMaster-Carr Style Instant Navigation & Predictive Preloading Engine
   + Automatic Markdown (.md) Client-Side Renderer for /critiques/
   ========================================================================== */

// 1. Speculation Rules API (Chrome / Edge / modern Chromium)
if (typeof HTMLScriptElement !== 'undefined' && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
    const specScript = document.createElement('script');
    specScript.type = 'speculationrules';
    specScript.textContent = JSON.stringify({
        prefetch: [
            {
                source: 'document',
                where: {
                    and: [
                        { href_matches: '/*' },
                        { not: { href_matches: '/*#*' } },
                        { not: { selector_matches: '[rel~="external"], [target="_blank"], [data-no-prefetch]' } }
                    ]
                },
                eagerness: 'moderate'
            }
        ],
        prerender: [
            {
                source: 'document',
                where: {
                    and: [
                        { href_matches: '/*' },
                        { not: { href_matches: '/*#*' } },
                        { not: { selector_matches: '[rel~="external"], [target="_blank"], [data-no-prefetch]' } }
                    ]
                },
                eagerness: 'moderate'
            }
        ]
    });
    document.head.appendChild(specScript);
}

// 2. Universal Predictive Preloader & Instant Navigation (PJAX)
(function initMcMasterEngine() {
    // Respect user bandwidth conservation preferences
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && (connection.saveData || (connection.effectiveType || '').includes('2g'))) {
        return;
    }

    const prefetchedUrls = new Set();
    const pageCache = new Map();
    let hoverTimer = null;
    const HOVER_DELAY_MS = 65; // Debounce to prevent wasted requests during fast cursor sweeps

    function isEligibleLink(anchor) {
        if (!anchor || anchor.tagName !== 'A') return false;
        const rawHref = anchor.getAttribute('href');
        if (!rawHref || rawHref === '#' || rawHref.startsWith('javascript:') || 
            rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
            return false;
        }
        if (anchor.target && anchor.target !== '_self') return false;
        if (anchor.hasAttribute('download') || anchor.hasAttribute('data-no-prefetch')) return false;
        if (anchor.rel && (anchor.rel.includes('external') || anchor.rel.includes('nofollow'))) return false;

        try {
            const url = new URL(anchor.href, window.location.href);
            if (window.location.protocol === 'file:') {
                if (url.protocol !== 'file:') return false;
                if (url.pathname === window.location.pathname) return false;
                return true;
            }
            // Same origin only
            if (url.origin !== window.location.origin) return false;
            // Avoid preloading current page
            if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
            return true;
        } catch {
            return false;
        }
    }

    function prefetchUrl(url) {
        if (prefetchedUrls.has(url)) return;
        prefetchedUrls.add(url);

        // Native <link rel="prefetch"> for browser cache warming
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        link.as = 'document';
        document.head.appendChild(link);

        // Fetch into in-memory cache for instant client swap
        if (window.fetch && window.location.protocol !== 'file:') {
            fetch(url, { priority: 'low', cache: 'force-cache' })
                .then(res => {
                    if (res.ok) return res.text();
                    throw new Error('Prefetch failed');
                })
                .then(rawText => {
                    let html = rawText;
                    // Auto-parse markdown if it's a .md file
                    if (url.toLowerCase().endsWith('.md')) {
                        html = convertMarkdownToHtmlPage(rawText, url);
                    }
                    pageCache.set(url, html);
                })
                .catch(() => {});
        }
    }

    function convertMarkdownToHtmlPage(rawText, url) {
        const parsedContent = typeof marked !== 'undefined' ? marked.parse(rawText) : `<pre>${rawText}</pre>`;
        
        // Extract title from first H1 if available, otherwise fallback to filename
        const titleMatch = rawText.match(/^#\s+(.+)$/m);
        const fileName = url.substring(url.lastIndexOf('/') + 1).replace('.md', '');
        const pageTitle = titleMatch ? `${titleMatch[1]} — PCB Critiques` : `${fileName} — PCB Critiques`;

        // Determine correct root path for header relative depth
        // If inside /critiques/, root relative path is '../'
        const depth = url.split('/').filter(Boolean).length;
        const rootPath = depth > 1 ? '../' : '';

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>${pageTitle}</title>
        </head>
        <body>
            <site-header root="${rootPath}"></site-header>
            <main id="content-wrapper">
                <article class="markdown-content" style="max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6;">
                    ${parsedContent}
                </article>
            </main>
        </body>
        </html>`;
    }

    function onPointerOver(event) {
        const anchor = event.target.closest('a');
        if (!anchor || !isEligibleLink(anchor)) return;

        const targetUrl = anchor.href;
        hoverTimer = setTimeout(() => {
            prefetchUrl(targetUrl);
        }, HOVER_DELAY_MS);
    }

    function onPointerOut(event) {
        const anchor = event.target.closest('a');
        if (anchor && hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }
    }

    function onPointerDown(event) {
        const anchor = event.target.closest('a');
        if (!anchor || !isEligibleLink(anchor)) return;
        prefetchUrl(anchor.href);
    }

    // 3. Instant Client Navigation (PJAX) with Markdown support
    async function loadPage(url, push = true) {
        try {
            let html = pageCache.get(url);
            if (!html) {
                const res = await fetch(url, { cache: 'force-cache' });
                if (!res.ok) throw new Error('Fetch failed');
                const rawText = await res.text();

                if (url.toLowerCase().endsWith('.md')) {
                    html = convertMarkdownToHtmlPage(rawText, url);
                } else {
                    html = rawText;
                }
                pageCache.set(url, html);
            }

            const parser = new DOMParser();
            const newDoc = parser.parseFromString(html, 'text/html');

            // 1. Update Title
            if (newDoc.title) {
                document.title = newDoc.title;
            }

            // 2. Synchronize <site-header> links
            const newHeader = newDoc.querySelector('site-header');
            const curHeader = document.querySelector('site-header');
            if (curHeader) {
                const targetRoot = newHeader ? (newHeader.getAttribute('root') || '') : '';
                if (targetRoot) {
                    curHeader.setAttribute('root', targetRoot);
                } else {
                    curHeader.removeAttribute('root');
                }
                curHeader.innerHTML = SiteHeader.getHTML(targetRoot);
            }

            // 3. Swap #content-wrapper
            const newContent = newDoc.querySelector('#content-wrapper');
            const curContent = document.querySelector('#content-wrapper');
            if (newContent && curContent) {
                curContent.replaceWith(newContent);
            }

            // 4. Update History
            if (push) {
                history.pushState({ url }, '', url);
            }

            // 5. Scroll to top or anchor
            const targetUrlObj = new URL(url, window.location.href);
            if (targetUrlObj.hash) {
                const targetEl = document.querySelector(targetUrlObj.hash);
                if (targetEl) {
                    targetEl.scrollIntoView();
                } else {
                    window.scrollTo(0, 0);
                }
            } else {
                window.scrollTo(0, 0);
            }
        } catch {
            // Graceful fallback to native navigation
            window.location.href = url;
        }
    }

    function onLinkClick(event) {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) {
            return;
        }
        if (window.location.protocol === 'file:') {
            return;
        }

        const anchor = event.target.closest('a');
        if (!anchor || !isEligibleLink(anchor)) return;

        event.preventDefault();
        loadPage(anchor.href, true);
    }

    window.addEventListener('popstate', () => {
        if (window.location.protocol !== 'file:') {
            loadPage(window.location.href, false);
        }
    });

    // Event listeners
    document.addEventListener('click', onLinkClick);
    document.addEventListener('pointerover', onPointerOver, { passive: true });
    document.addEventListener('pointerout', onPointerOut, { passive: true });
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('touchstart', onPointerDown, { passive: true });
})();