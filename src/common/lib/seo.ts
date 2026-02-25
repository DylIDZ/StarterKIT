// ─── Types ──────────────────────────────────────────────────────────

export interface MetaTagsInput {
    title: string;
    description: string;
    url?: string;
    image?: string;
    siteName?: string;
    locale?: string;
    type?: "website" | "article" | "product" | "profile";
    twitterCard?: "summary" | "summary_large_image" | "app" | "player";
    twitterSite?: string;
    keywords?: string[];
    author?: string;
    publishedTime?: string;
    modifiedTime?: string;
}

export interface JsonLdInput {
    type: "Organization" | "Product" | "Article" | "BreadcrumbList" | "FAQPage" | "WebPage";
    data: Record<string, unknown>;
}

export interface SitemapEntry {
    url: string;
    lastmod?: string;
    changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
    priority?: number;
}

// ─── SEO Generator ──────────────────────────────────────────────────

export class SeoGenerator {
    /**
     * Generate HTML meta tags string (Open Graph + Twitter Card).
     */
    static generateMetaTags(input: MetaTagsInput): string {
        const tags: string[] = [];

        // Basic meta
        tags.push(`<title>${SeoGenerator.escapeHtml(input.title)}</title>`);
        tags.push(`<meta name="description" content="${SeoGenerator.escapeHtml(input.description)}" />`);

        if (input.keywords?.length) {
            tags.push(`<meta name="keywords" content="${input.keywords.join(", ")}" />`);
        }
        if (input.author) {
            tags.push(`<meta name="author" content="${SeoGenerator.escapeHtml(input.author)}" />`);
        }

        // Open Graph
        tags.push(`<meta property="og:title" content="${SeoGenerator.escapeHtml(input.title)}" />`);
        tags.push(`<meta property="og:description" content="${SeoGenerator.escapeHtml(input.description)}" />`);
        tags.push(`<meta property="og:type" content="${input.type || "website"}" />`);

        if (input.url) tags.push(`<meta property="og:url" content="${input.url}" />`);
        if (input.image) tags.push(`<meta property="og:image" content="${input.image}" />`);
        if (input.siteName) tags.push(`<meta property="og:site_name" content="${SeoGenerator.escapeHtml(input.siteName)}" />`);
        if (input.locale) tags.push(`<meta property="og:locale" content="${input.locale}" />`);

        // Article-specific
        if (input.type === "article") {
            if (input.publishedTime) tags.push(`<meta property="article:published_time" content="${input.publishedTime}" />`);
            if (input.modifiedTime) tags.push(`<meta property="article:modified_time" content="${input.modifiedTime}" />`);
        }

        // Twitter Card
        tags.push(`<meta name="twitter:card" content="${input.twitterCard || "summary_large_image"}" />`);
        tags.push(`<meta name="twitter:title" content="${SeoGenerator.escapeHtml(input.title)}" />`);
        tags.push(`<meta name="twitter:description" content="${SeoGenerator.escapeHtml(input.description)}" />`);

        if (input.image) tags.push(`<meta name="twitter:image" content="${input.image}" />`);
        if (input.twitterSite) tags.push(`<meta name="twitter:site" content="${input.twitterSite}" />`);

        return tags.join("\n");
    }

    /**
     * Generate JSON-LD structured data script tag.
     */
    static generateJsonLd(input: JsonLdInput): string {
        const jsonLd = {
            "@context": "https://schema.org",
            "@type": input.type,
            ...input.data,
        };

        return `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>`;
    }

    /**
     * Generate an XML sitemap string.
     */
    static generateSitemap(entries: SitemapEntry[]): string {
        const urls = entries.map((entry) => {
            let urlBlock = `  <url>\n    <loc>${SeoGenerator.escapeXml(entry.url)}</loc>`;
            if (entry.lastmod) urlBlock += `\n    <lastmod>${entry.lastmod}</lastmod>`;
            if (entry.changefreq) urlBlock += `\n    <changefreq>${entry.changefreq}</changefreq>`;
            if (entry.priority !== undefined) urlBlock += `\n    <priority>${entry.priority}</priority>`;
            urlBlock += "\n  </url>";
            return urlBlock;
        });

        return [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...urls,
            "</urlset>",
        ].join("\n");
    }

    /**
     * Generate a robots.txt string.
     */
    static generateRobotsTxt(options: {
        sitemapUrl?: string;
        disallow?: string[];
        allow?: string[];
        crawlDelay?: number;
    } = {}): string {
        const lines: string[] = ["User-agent: *"];

        if (options.allow?.length) {
            for (const path of options.allow) {
                lines.push(`Allow: ${path}`);
            }
        }

        if (options.disallow?.length) {
            for (const path of options.disallow) {
                lines.push(`Disallow: ${path}`);
            }
        } else {
            lines.push("Disallow:");
        }

        if (options.crawlDelay) {
            lines.push(`Crawl-delay: ${options.crawlDelay}`);
        }

        if (options.sitemapUrl) {
            lines.push("", `Sitemap: ${options.sitemapUrl}`);
        }

        return lines.join("\n");
    }

    // ─── Helpers ─────────────────────────────────────────────────

    private static escapeHtml(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    private static escapeXml(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }
}
