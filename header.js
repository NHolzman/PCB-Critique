// Inject display: block for the custom element
const style = document.createElement('style');
style.textContent = 'site-header { display: block; }';
document.head.appendChild(style);

class SiteHeader extends HTMLElement {
    connectedCallback() {
        // Detect relative root path based on the script's src attribute
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

        this.innerHTML = `
            <header>
                <h1>The website to critique PCBs</h1>
                <p>Associated with the pro nuclear energy committee &bull; Established in 2026</p>
            </header>
            <nav>
                <a href="${root}index.html">[Home]</a>
                <a href="#">[Archive]</a>
                <a href="${root}documentation/index.html">[Documentation]</a>
                <a href="${root}critiques/index.html">[Critiques]</a>
                <a href="#">[Contact]</a>
                <a href="https://pronucleaire.org" target="_blank" rel="noopener noreferrer">[Comité pro énergie nucléaire ↗]</a>
            </nav>
        `;
    }
}

if (!customElements.get('site-header')) {
    customElements.define('site-header', SiteHeader);
}

/* ==========================================================================
   McMaster-Carr Style Predictive Preloading Engine
   - Speculation Rules API: Native 0ms prerender / prefetch on modern browsers
   - Predictive Hover Debounce (65ms): Prefetches pages when cursor hovers
   - Instant Pointerdown / Touch: Prefetches immediately on tap/mousedown
   - Bandwidth awareness: Respects Save-Data & slow 2G connections
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
                eagerness: 'conservative'
            }
        ]
    });
    document.head.appendChild(specScript);
}

// 2. Universal Predictive Hover & Pointer Preloader (Safari, Firefox, All browsers)
(function initPredictivePreloader() {
    // Respect user bandwidth conservation preferences
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && (connection.saveData || (connection.effectiveType || '').includes('2g'))) {
        return;
    }

    const prefetchedUrls = new Set();
    let hoverTimer = null;
    const HOVER_DELAY_MS = 65; // Debounce to prevent wasted requests during fast cursor sweeps

    function isEligibleLink(anchor) {
        if (!anchor || anchor.tagName !== 'A') return false;
        const rawHref = anchor.getAttribute('href');
        if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || 
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

        // Fetch fallback with low priority
        if (window.fetch && window.location.protocol !== 'file:') {
            fetch(url, { priority: 'low', cache: 'force-cache' }).catch(() => {});
        }
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
        // Preload immediately on touch or mouse down to utilize the 100-300ms click delay
        prefetchUrl(anchor.href);
    }

    // Passive event listeners for zero scroll/render lag
    document.addEventListener('pointerover', onPointerOver, { passive: true });
    document.addEventListener('pointerout', onPointerOut, { passive: true });
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('touchstart', onPointerDown, { passive: true });
})();


