# AI-Assisted Development Notes

## Chrome Extension Setup

### Task

Turn the React + Vite project into a basic Chrome extension.

### What I asked AI

I asked Copilot to plan the smallest way to make the React app open as a Chrome extension popup.

I told it not to add:

* extra permissions
* background scripts
* content scripts
* new dependencies

### What AI suggested

Copilot suggested adding only:

`public/manifest.json`

### What I accepted

I accepted the simple approach.

### What I changed or rejected

Nothing needed to be changed.

### Testing

* `npm run lint`
* `npm run build`
* Loaded the `dist` folder in Chrome
* Confirmed the React app opened correctly