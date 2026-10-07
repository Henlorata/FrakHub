import {getSupabaseAdmin} from "./_lib/supabase.js";

/**
 * Link previews for the news (Discord, Facebook, ...). The app is a single page, so its <head> is
 * the same for every address; vercel.json sends only the link-preview bots asking for /news/<slug>
 * here. They get the article's title, lead and cover (and a link, should a person ever land here:
 * no automatic redirect, it would come back to the same rule). Answers are cached at the edge (a
 * shared link is fetched by many bots), so this costs a few invocations per article, not one per view.
 */

const SITE = "San Fierro Sheriff's Department";
const DEFAULT_DESCRIPTION = "Hírek, osztályok, toborzás és a tagok intranetje.";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"})[char] ?? char);

/** A Cloudinary cover cut to the 1200×630 preview size (other hosts are never used for covers). */
function previewImage(url: unknown): string | null {
  if (typeof url !== "string" || !url.startsWith("https://res.cloudinary.com/") || !url.includes("/upload/")) return null;
  return url.replace("/upload/", "/upload/c_fill,g_auto,w_1200,h_630,q_auto,f_jpg/");
}

interface PreviewPost {
  title?: string;
  excerpt?: string | null;
  cover_url?: string | null;
  published_at?: string | null;
  author_display?: string | null;
}

async function loadPost(slug: string): Promise<PreviewPost | null> {
  try {
    // As a visitor would see it: get_news_post() returns published articles only (no signed-in editor here).
    const {data, error} = await getSupabaseAdmin().rpc("get_news_post", {_slug: slug});
    if (error) throw error;
    return ((data as {post?: PreviewPost} | null)?.post) ?? null;
  } catch (error) {
    console.error("[api/news-preview]", error);
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") ?? "").trim().toLowerCase();
  const valid = /^[a-z0-9-]{1,90}$/.test(slug);
  const target = valid ? `${url.origin}/news/${slug}` : `${url.origin}/news`;
  const post = valid ? await loadPost(slug) : null;

  const title = post?.title ? `${post.title} – ${SITE}` : SITE;
  const description = (post?.excerpt ?? "").trim() || DEFAULT_DESCRIPTION;
  const image = previewImage(post?.cover_url);
  const meta = [
    ["og:type", post ? "article" : "website"],
    ["og:site_name", SITE],
    ["og:title", post?.title ?? SITE],
    ["og:description", description],
    ["og:url", target],
    ["og:locale", "hu_HU"],
    ...(image ? [["og:image", image], ["og:image:width", "1200"], ["og:image:height", "630"]] : []),
    ...(post?.published_at ? [["article:published_time", post.published_at]] : []),
  ];

  const html = `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
${meta.map(([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}">`).join("\n")}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
<meta name="theme-color" content="#f59e0b">
<link rel="canonical" href="${escapeHtml(target)}">
</head>
<body><p><a href="${escapeHtml(target)}">${escapeHtml(post?.title ?? SITE)}</a></p><p>${escapeHtml(description)}</p></body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Only public, published content: the edge may keep it (shorter while the article is not found).
      "Cache-Control": post ? "public, max-age=0, s-maxage=600, stale-while-revalidate=86400" : "public, max-age=0, s-maxage=60",
    },
  });
}
