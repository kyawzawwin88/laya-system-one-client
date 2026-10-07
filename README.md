# System One Playground UI

Chrome extension for sending one Laya decide request and reading the typed response.

The page is a full-screen playground. The left column edits the request. The right column shows the API request that will be sent, the response, and session history.

Available in chrome app store: <a href="https://chromewebstore.google.com/detail/system-one-playground-ui/kbocpanpfjanemolcoaaekpjbnignmhk">https://chromewebstore.google.com/detail/system-one-playground-ui/kbocpanpfjanemolcoaaekpjbnignmhk</a>

## Request

`POST {base URL}/api/decide` with JSON:

- `model`
- `state` (shown in the form as User Message)
- `questions` (built from the Context Schema tab)
- `keep_alive`

The base URL is editable and saved in `chrome.storage.local`. The sample default is `http://192.168.2.50:11435`. A trailing slash is stripped before `/api/decide` is appended. The scheme must be `http` or `https`.

Context schema objects are `choice`, `score`, or `noul`. The sample request routes a billing message to a department, an urgency score, and a refund decision.

## Response

Choice answers show the selected label, confidence, and probabilities. Score answers show the score, legend, and probabilities. Noul answers show the number. Durations from the API are nanoseconds and are displayed in seconds.

Raw JSON switches the current response to the original payload. History keeps each send in `sessionStorage`: the request is stored when it is sent, then updated when the response arrives. History lasts for the browser session.

## Develop

Requires Node.js and Chrome.

```bash
cd app
npm install
npm test
npm run build
```

`npm run build` writes the extension to `app/dist` and resizes `assets/logo.png` to 16, 32, 64, and 128 pixel icons.

## Load the extension

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Choose Load unpacked and select `app/dist`.
4. Click the toolbar icon. It opens the playground in a tab.

Reload the unpacked extension after each build.

If the API returns HTTP 403 because a `chrome-extension://` origin is not allowed, allow that origin on the Laya host (for example `OLLAMA_ORIGINS`) and restart Laya. The extension cannot remove the Origin header Chrome sends.

## Layout

| Path | Role |
| --- | --- |
| `app/src` | TypeScript UI, request builder, schema editor, history |
| `app/dist` | Built extension to load in Chrome |
| `assets/logo.png` | Source icon |

<p dir="auto">If you find this extension useful, consider <a href="https://buymeacoffee.com/kyawzawwin" rel="nofollow">buying me a coffee</a>! ☕</p>
