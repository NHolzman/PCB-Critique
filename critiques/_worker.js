import { marked } from 'https://esm.sh/marked';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // Remove trailing slash if present
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // Determine target markdown file path (supports both /critiques/test and /critiques/test.md)
    let targetPath = pathname.toLowerCase().endsWith('.md') ? pathname : pathname + '.md';

    // Try fetching the markdown file from your Cloudflare static assets
    const mdRequest = new Request(new URL(targetPath, request.url), request);
    const mdRes = await env.ASSETS.fetch(mdRequest);

    if (mdRes.ok) {
      const markdownText = await mdRes.text();
      const parsedContent = marked.parse(markdownText);

      // Extract title from the first H1 heading if available
      const titleMatch = markdownText.match(/^#\s+(.+)$/m);
      const pageTitle = titleMatch ? `${titleMatch[1]} — PCB Critiques` : 'PCB Critique';

      // Calculate correct relative depth for header.js
      const depth = pathname.split('/').filter(Boolean).length;
      const rootPath = depth > 1 ? '../' : '';

      // Generate the fully rendered HTML page server-side
      const html = `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <title>${pageTitle}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="${rootPath}header.js" defer></script>
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

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
        },
      });
    }

    // Fall back to standard asset handling for normal files/folders
    return env.ASSETS.fetch(request);
  },
};