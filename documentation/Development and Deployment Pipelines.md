# Development and Deployment Pipelines

## Development

```text
Mac: edit source code
        ↓
Sync project to Raspberry Pi
        ↓
Raspberry Pi:
npm run dev
        ↓
Build + watch + server
        ↓
Raspberry Pi:
npm run watch device
        ↓
Device client + R-IoT + audio
```

During development, the goal is to use the watch mode so changes can be rebuilt automatically.

## Deployment

```text
Mac: edit source code
        ↓
Sync project to Raspberry Pi
        ↓
Raspberry Pi:
npm run build
        ↓
Start server:
node .build/server.js
        ↓
Start device client:
npm run watch device
        ↓
R-IoT + scripts + audio
```

The deployment pipeline uses the generated `.build/` output and runs the server and device client independently.

> **Note:** `npm run start` currently points to `.build/server/index.js`, while the build generates `.build/server.js`. The working server entry point is therefore `node .build/server.js`.