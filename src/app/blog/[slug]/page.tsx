import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_POSTS, getBlogPost } from "../posts";
import "@/styles/blog.css";

type ArticlePageProps = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const post = getBlogPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { title: post.title, description: post.description, type: "article" },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const post = getBlogPost((await params).slug);
  if (!post) notFound();
  const morePosts = BLOG_POSTS.filter(({ slug }) => slug !== post.slug).slice(0, 3);
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Person", name: "Yuyang Hu", sameAs: ["https://github.com/yuyanghu06", "https://www.linkedin.com/in/yuyanghu06"] },
  };

  return (
    <main className="blog-page blog-page--article">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, "\\u003c") }} />
      <nav className="blog-nav" aria-label="Blog navigation">
        <Link href="/blog">← all extremely serious articles</Link>
        <Link href="/">tiny planet</Link>
      </nav>
      <article className="blog-article">
        <header>
          <p className="blog-eyebrow">Yuyang Hu · {post.readTime} read</p>
          <h1>{post.title}</h1>
          <p className="blog-dek">{post.dek}</p>
        </header>
        {post.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>
        ))}
      </article>
      <aside className="blog-more" aria-label="More articles">
        <p className="blog-eyebrow">More important scholarship</p>
        {morePosts.map((item) => <Link href={`/blog/${item.slug}`} key={item.slug}>{item.title} →</Link>)}
      </aside>
    </main>
  );
}
