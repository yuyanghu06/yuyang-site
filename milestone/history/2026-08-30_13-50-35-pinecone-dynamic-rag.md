# Pinecone-only dynamic RAG

Replaced unconditional pre-generation retrieval with a private server-side `search_personal_memory` tool. Base facts answer without retrieval; all other personal questions must search first, and missing evidence produces an explicit unknown. The tool classifies query domain, extracts entities, rewrites multi-turn follow-ups as standalone searches, and combines broad dense, domain-filtered dense, and lexically constrained Pinecone candidates through reciprocal-rank fusion.

Reset only the validated `memories/__default__` scope and ingested 166 contextual chunks across 153 records from the canonical Google Doc revision recorded in `milestone/current.md`. Pinecone is the sole deployed memory store. Google Doc exports and generated corpora existed only under `/tmp` during ingestion and were deleted afterward.

Updated the canonical Technical Skills section with Shift-acquired web/application architecture, Supabase, PostHog, Stripe/Shopify, Meta, Triple Whale, GoHighLevel, mobile, operations, attribution, and reliability experience, then rebuilt the index from that final revision.

Verification covered ESLint, TypeScript, exact Pinecone record count, base-fact retrieval bypass, private personal retrieval, lexical filtering, multi-turn pronoun resolution, and unsupported-fact refusal.
