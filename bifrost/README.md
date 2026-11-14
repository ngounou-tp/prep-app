# Foreword gateway

The [Bifrost](https://github.com/maximhq/bifrost) gateway that Foreword sends every model call
through, as a private Railway service in the same project as Foreword. This folder is the whole
service: `Dockerfile` (the official image, pinned to v2.5.1) and `config.json`, which holds no
secret, only `env.NAME` references.

It has no public address: Foreword reaches it over Railway's private network. It is locked down
all the same:

- every model call needs the virtual key (`x-bf-vk`);
- the dashboard and admin API need the admin login;
- only chat models of Groq and Gemini are allowed.

## Variables

Set these on the gateway service in Railway (**Variables**):

| Name | Value |
| --- | --- |
| `GROQ_API_KEY` | Your Groq key |
| `GEMINI_API_KEY` | Your Gemini key |
| `BIFROST_VIRTUAL_KEY` | A long random value that starts with `sk-bf-`; Foreword references it |
| `BIFROST_ADMIN_USERNAME` | The dashboard login |
| `BIFROST_ADMIN_PASSWORD` | A long random password |

`GET /health` answers without a key, on port 10000. The image listens on `::`, so it is reachable
whether the private network uses IPv4 or IPv6.
