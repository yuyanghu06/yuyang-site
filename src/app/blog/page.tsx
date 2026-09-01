import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_POSTS } from "./posts";
import "@/styles/blog.css";

export const metadata: Metadata = {
  title: "Yuyang Hu's Extremely Serious Blog",
  description: "Casual notes about Yuyang Hu, NYU, robotics, student tech clubs, startups, and why you should probably hire him.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  return (
    <main className="blog-page">
      <nav className="blog-nav" aria-label="Blog navigation">
        <Link href="/">← back to the tiny planet</Link>
      </nav>
      <section className="blog-grid" aria-label="Articles">
        {BLOG_POSTS.map((post, index) => (
          <article className="blog-card" key={post.slug}>
            <p className="blog-card__number">{String(index + 1).padStart(2, "0")}</p>
            <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
            <p>{post.description}</p>
            <span>{post.readTime} read</span>
          </article>
        ))}
      </section>
    </main>
  );
}
