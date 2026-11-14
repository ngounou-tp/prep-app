# Foreword gateway

The [Bifrost](https://github.com/maximhq/bifrost) gateway that Foreword sends every model call
through, deployed beside Foreword on whichever host is available: Railway (dashboard steps in the
root README) or Render (`render.yaml`). This folder is the whole service: `Dockerfile` (the official
image, pinned to v2.5.1) and `config.json`, which holds no secret, only `env.NAME` references.

On Railway it has no public address: Foreword reaches it over the private network. On Render it is
public, because private services are not free there. Either way it is locked down:

- every model call needs the virtual key (`x-bf-vk`);
- the dashboard and admin API need the admin login;
- only chat models of Groq and Gemini are allowed.

## Variables

| Name | Value |
| --- | --- |
| `GROQ_API_KEY` | Your Groq key |
| `GEMINI_API_KEY` | Your Gemini key |
| `BIFROST_VIRTUAL_KEY` | A long random value that starts with `sk-bf-`; Foreword gets the same value |
| `BIFROST_ADMIN_USERNAME` | The dashboard login |
| `BIFROST_ADMIN_PASSWORD` | A long random password |

`GET /health` answers without a key, on port 10000. The image listens on `::`, so it is reachable
over IPv4 and IPv6. It loads its model catalogue first, so the first answer can take a minute.
