// Rewrites the "Latest from the High Entropy Diary" list in README.md from the site's RSS feed.
// Poems stay on the site; the profile lists the essays only.
import { readFile, writeFile } from "node:fs/promises";

const FEED = process.env.FEED ?? "https://highentropy001.com/rss.xml";
const SKIP = new Set(["Poems"]);
const COUNT = 5;
const START = "<!-- BLOG-POST-LIST:START -->";
const END = "<!-- BLOG-POST-LIST:END -->";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const unescape = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const tag = (item, name) => [...item.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "g"))].map((m) => unescape(m[1]).trim());
// Square brackets would break the Markdown link text.
const linkText = (s) => s.replace(/[[\]]/g, "\\$&");

const res = await fetch(FEED);
if (!res.ok) throw new Error(`${FEED}: HTTP ${res.status}`);
const xml = await res.text();

const posts = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
  .map(([, item]) => ({ title: tag(item, "title")[0], url: tag(item, "link")[0], date: new Date(tag(item, "pubDate")[0]), categories: tag(item, "category") }))
  .filter((post) => post.title && post.url && !post.categories.some((c) => SKIP.has(c)))
  .sort((a, b) => b.date - a.date)
  .slice(0, COUNT);
if (posts.length === 0) throw new Error("No posts found in the feed; leaving README.md alone.");

const lines = posts.map(({ title, url, date }) =>
  `- [${linkText(title)}](${url}) <sub>${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}</sub>`);

const readme = await readFile("README.md", "utf8");
const start = readme.indexOf(START), end = readme.indexOf(END);
if (start < 0 || end < start) throw new Error("README.md is missing the BLOG-POST-LIST markers.");
const next = `${readme.slice(0, start + START.length)}\n${lines.join("\n")}\n${readme.slice(end)}`;
if (next !== readme) await writeFile("README.md", next);
console.log(lines.join("\n"));
