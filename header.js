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

