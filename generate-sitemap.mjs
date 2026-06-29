import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = "https://www.acrozo.eu.cc";
const TODAY = new Date().toISOString().split("T")[0];

const routes = [
  { loc: "/",                          changefreq: "weekly",  priority: "1.0" },
  { loc: "/pricing",                   changefreq: "monthly", priority: "0.9" },
  { loc: "/tally-generator",           changefreq: "monthly", priority: "0.8" },
  { loc: "/tally-tdls",                changefreq: "monthly", priority: "0.7" },
  { loc: "/tools/gst-calculator",      changefreq: "monthly", priority: "0.8" },
  { loc: "/tools/tds-interest-calculator", changefreq: "monthly", priority: "0.8" },
  { loc: "/tools/income-tax-calculator",   changefreq: "monthly", priority: "0.8" },
  { loc: "/pdf-converter",             changefreq: "monthly", priority: "0.7" },
  { loc: "/sbi-to-tally",             changefreq: "monthly", priority: "0.9" },
  { loc: "/hdfc-to-tally",            changefreq: "monthly", priority: "0.9" },
  { loc: "/icici-to-tally",           changefreq: "monthly", priority: "0.9" },
  { loc: "/axis-to-tally",            changefreq: "monthly", priority: "0.9" },
  { loc: "/pnb-to-tally",             changefreq: "monthly", priority: "0.9" },
  { loc: "/kotak-to-tally",           changefreq: "monthly", priority: "0.9" },
  { loc: "/bob-to-tally",             changefreq: "monthly", priority: "0.9" },
  { loc: "/indusind-to-tally",        changefreq: "monthly", priority: "0.9" },
  { loc: "/yesbank-to-tally",         changefreq: "monthly", priority: "0.9" },
  { loc: "/idfcfirst-to-tally",       changefreq: "monthly", priority: "0.9" },
  { loc: "/federal-to-tally",         changefreq: "monthly", priority: "0.9" },
  { loc: "/canara-to-tally",          changefreq: "monthly", priority: "0.9" },
  { loc: "/unionbank-to-tally",       changefreq: "monthly", priority: "0.9" },
  { loc: "/idbi-to-tally",            changefreq: "monthly", priority: "0.9" },
  { loc: "/rbl-to-tally",             changefreq: "monthly", priority: "0.9" },
  { loc: "/central-to-tally",         changefreq: "monthly", priority: "0.9" },
  { loc: "/indianbank-to-tally",      changefreq: "monthly", priority: "0.9" },
  { loc: "/bandhan-to-tally",         changefreq: "monthly", priority: "0.9" },
  { loc: "/sib-to-tally",             changefreq: "monthly", priority: "0.9" },
  { loc: "/boi-to-tally",             changefreq: "monthly", priority: "0.9" },
  { loc: "/iob-to-tally",             changefreq: "monthly", priority: "0.9" },
];

const urlEntries = routes
  .map(
    ({ loc, changefreq, priority }) => `  <url>
    <loc>${BASE_URL}${loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
  )
  .join("\n");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
    http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries}
</urlset>
`;

const outputPath = join(__dirname, "frontend", "public", "sitemap.xml");
writeFileSync(outputPath, sitemap, "utf-8");
console.log(`✅ sitemap.xml written to ${outputPath}`);
