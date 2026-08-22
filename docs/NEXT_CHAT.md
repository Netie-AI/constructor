Paste this into a new Cursor chat in `D:\Constructor` if the current agent stops:

Constructor is a Cortex consumer. Pages https://netie-ai.github.io/constructor/ stays HTTP 200, 0 fetch, 0 keys.
Engine is https://app.netie.ai/cortex (and local http://127.0.0.1:8010/cortex). Keys required.
Do not invent a host. Do not merge landing. No Supabase. No n8n.

Cortex branch cursor/constructor-cortex-mount: /cortex/login + /cortex/constructor + POST /cortex/constructor/run.
LiteSpeed app.netie.ai still 404s /cortex until it reverse-proxies to :8010/cortex.

Verify: pytest tests/dms/test_constructor_graph.py -p no:playwright
Pages: Invoke-WebRequest https://netie-ai.github.io/constructor/ StatusCode 200
