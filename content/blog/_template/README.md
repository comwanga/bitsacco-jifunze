# Writing a blog post (Makala)

This folder is a template. The build ignores it. Full steps are in [CONTRIBUTING.md](../../../CONTRIBUTING.md#writing-a-blog-post).

1. Pick a slug: lowercase words joined by hyphens, for example `what-a-chama-should-ask-first`.
2. Copy `post-entry.json` into the list in `content/blog/posts.json` and fill it in.
3. Copy `post.mdx` to `content/blog/sw/<slug>.mdx` for Kiswahili, `content/blog/en/<slug>.mdx` for English, or both.
4. Delete the parts of the template you don't use (diagram, video, video link).
5. Open a pull request. CI explains anything missing in plain words; the owner reviews and merges.
