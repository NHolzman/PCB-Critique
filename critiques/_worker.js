export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Check if the requested file is a markdown file
    if (url.pathname.toLowerCase().endsWith('.md')) {
      // Fetch the raw markdown file from your static assets
      const res = await env.ASSETS.fetch(request);
      if (!res.ok) return res;

      const markdownText = await res.text();

      // Determine correct relative path back to root for header.js
      const depth = url.pathname.split('/').filter(Boolean).length;
      const rootPath = depth > 1 ? '../' : '';

      // Generate the full HTML response containing the markdown
      const html = `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <title>PCB Critique</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <!-- Include Marked.js for markdown parsing -->
          <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
          <!-- Include your header script -->
          <script src="${rootPath}header.js" defer></script>
      </head>
      <body>
          <site-header root="${rootPath}"></site-header>
          <main id="content-wrapper">
              <article id="markdown-container" style="max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6;">
                  <p>Loading critique...</p>
              </article>
          </main>

          <script>
              const rawMarkdown = ${JSON.stringify(markdownText)};
              window.addEventListener('DOMContentLoaded', () => {
                  if (typeof marked !== 'undefined') {
                      document.getElementById('markdown-container').innerHTML = marked.parse(rawMarkdown);
                      
                      // Auto-extract title from the first H1 tag
                      const titleMatch = rawMarkdown.match(/^#\\s+(.+)$/m);
                      if (titleMatch) {
                          document.title = titleMatch[1] + ' — PCB Critiques';
                      }
                  } else {
                      document.getElementById('markdown-container').innerHTML = '<pre>' + rawMarkdown + '</pre>';
                  }
              });
          </script>
      </body>
      </html>`;

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
        },
      });
    }

    // For all other files, pass through normally
    return env.ASSETS.fetch(request);
  },
};