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
Reconnecting the R-IoT devices may temporarily interrupt SSH connectivity to the Raspberry Pi, while the Soundworks server, device client, R-IoT processing and audio continue operating normally. Connectivity is restored automatically.

---

# Changelog — 2026-08-18

## Fix: errores de build "unresolved node built-ins" en scripts Como

**Síntoma:** al arrancar el servidor Como se mostraban errores `Could not resolve "node:fs"` / `Could not resolve "node:path"` / `Could not resolve "node:url"` para los scripts `test_joaku.js` y `biquad_filter_up.js`. El audio funcionaba correctamente en la Pi.

**Causa raíz:** el plugin de scripting de Como (`@soundworks/plugin-scripting`) compila **cada** script para **dos plataformas** (`browser` y `node`) mediante esbuild (`ServerPluginScripting.js`). `layer-synth.js` importaba estáticamente `node:fs`, `node:path` y `node:url`, por lo que el bundle **browser** no podía resolver dichos módulos. La Pi solo ejecuta el bundle **node** (runtime `node`), por eso no fallaba en runtime. **Nota:** estos errores provienen del esbuild del **servidor Como** (runtime), no de la CLI `soundworks-build`, que solo transpila `src/` y no procesa `projects/`.

**Cambios realizados:**

- **Nuevo `synths/layer-synth/loader.node.js`:** lógica de filesystem movida del synth (`fs`, `path`, `url`, `__dirname`, escaneo recursivo de `soundbanks/<bank>/layers` y `shorts`); exporta `loadSoundbank(audioBufferLoader, soundbank)`.
- **Nuevo `synths/layer-synth/loader.browser.js`:** stub sin dependencias de Node con la misma firma (error descriptivo si se usa en browser).
- **Modificado `synths/layer-synth/layer-synth.js`:** eliminados los imports `node:*`; `createLayerSynth` delega ahora en `loadSoundbank` a través de `#layer-synth/loader.js`. La clase `LayerSynth`, la lista `list` y el grafo WebAudio no cambian.
- **Modificado `package.json` (raíz):** añadido:

  ```json
  "imports": {
    "#layer-synth/loader.js": {
      "browser": "./synths/layer-synth/loader.browser.js",
      "node": "./synths/layer-synth/loader.node.js"
    }
  }
  ```

  **Importante:** usar condiciones `browser`/`node`. No copiar la estructura `module`/`node` de `@ircam/como`: esbuild activa la condición `module` también en plataforma `node`, lo que resolvería silenciosamente el stub de browser en el bundle node y rompería la Pi.

**Verificación:**

- Bundle esbuild de `test_joaku.js` y `biquad_filter_up.js`: OK en `browser` y `node` (antes fallaba `browser`).
- Bundle `node`: `node:fs` queda como external, `loader.node.js` queda inlineado y `import.meta.url` reescrito (misma ruta absoluta `synths/layer-synth` → comportamiento runtime idéntico).
- Bundle `browser`: sin built-ins de Node, usa el stub.
- `npm run build` completo (SWC + rolldown de clientes) → OK.
- `node --check` en los tres archivos → OK.

**Cambios no incluidos:** el árbol de trabajo contenía cambios locales previos en `test_joaku.js` / `biquad_filter_up.js` (guard de gyroscope + ajuste de whitespace) que no forman parte de esta corrección.

**Reversión:** revertir `synths/layer-synth/layer-synth.js` y `package.json`, y eliminar `synths/layer-synth/loader.node.js` y `synths/layer-synth/loader.browser.js`.