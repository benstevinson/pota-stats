import { PAGE_PATH, SUMMARY_FILES } from './config';
import { renderPage } from './render-page';
import { renderLlmsTxt, renderSitemap } from './seo';
import { isSummaryFile, loadPageSummaryData } from './summaries';

interface Env {
  R2: R2Bucket;
  ASSETS: Fetcher;
}

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function response(body: BodyInit | null, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: {
      ...securityHeaders,
      ...init.headers,
    },
  });
}

function redirect(location: string, status = 308): Response {
  return response(null, {
    status,
    headers: { Location: location },
  });
}

async function handleSummaryApi(pathname: string, env: Env): Promise<Response | null> {
  const prefix = '/pota-stats/api/summaries/';
  if (!pathname.startsWith(prefix)) return null;

  const file = pathname.slice(prefix.length);
  if (!isSummaryFile(file)) {
    return response(JSON.stringify({ error: 'Unknown summary file', allowed: SUMMARY_FILES }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const object = await env.R2.get(`summaries/${file}`);
  if (!object) {
    return response(JSON.stringify({ error: 'Summary file not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  return response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return response(JSON.stringify({ status: 'ok', service: 'pota-web' }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  if (url.pathname === '/pota-stats') {
    return redirect(PAGE_PATH);
  }

  if (url.pathname.startsWith('/pota-stats/assets/')) {
    return env.ASSETS.fetch(request);
  }

  const summaryResponse = await handleSummaryApi(url.pathname, env);
  if (summaryResponse) return summaryResponse;

  if (url.pathname === PAGE_PATH) {
    const data = await loadPageSummaryData(env.R2);
    return response(renderPage(data), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    });
  }

  if (url.pathname === '/pota-stats/sitemap.xml') {
    const data = await loadPageSummaryData(env.R2);
    return response(renderSitemap(data), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  if (url.pathname === '/pota-stats/llms.txt') {
    const data = await loadPageSummaryData(env.R2);
    return response(renderLlmsTxt(data), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  return response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export default {
  fetch: handleRequest,
};
