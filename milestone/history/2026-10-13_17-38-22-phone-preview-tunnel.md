# Phone preview tunnel

The user requested a dev server and Cloudflare Tunnel for phone inspection of the new development branch. The repository remains on published `codex/dev-san-diego-expansion` at `fbf0352`. Cloudflared 2026.10.0 was downloaded from Cloudflare's official Darwin arm64 release into `/tmp/yuyang-sd-tunnel/` and started detached. Its temporary URL is `https://accordingly-bacteria-mountains-thinks.trycloudflare.com`; it forwards to `127.0.0.1:3000` and remains valid only while the local server/tunnel/Mac are running.

Next.js rejected the tunnel Origin, so `next.config.ts` now accepts a single optional `NEXT_DEV_ALLOWED_ORIGIN`; unset means no additional origins. The verified repository server was gracefully restarted with the exact hostname. At handoff, npm PID62744/server62776 and cloudflared PID60043 are alive; log and PID files are under the same temporary directory. Root INFO documents usage. These config/docs changes remain local and uncommitted.

Independent checks confirm public homepage and Origin-bearing client JavaScript200, HMR101, final model hash `99b84b00…e837b0`, model size24,961,752bytes, and403 for an unrelated Origin. Browser inspection confirms the interactive page without application errors. Targeted config lint and whitespace pass. No new production build, commit, push, or deployment was performed.
