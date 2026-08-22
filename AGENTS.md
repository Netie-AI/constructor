# Constructor agent notes

- Ticket: Netie-AI/landing#9. Parent: landing#8.
- First path is static. No login, no Supabase, no n8n, no Activepieces clone.
- Public URL must be this repo's Pages site or a Release. Do not invent a host.
- Do not merge landing from this repo.
- Stop hook in `.cursor/hooks` continues the agent until `.constructor-live` exists.
