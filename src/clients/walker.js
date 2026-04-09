import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import { loadConfig, launcher } from '@soundworks/helpers/browser.js';
import { html, render } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import ComoClient from '@ircam/como/ComoClient.js';

import '@ircam/sc-components/sc-slider.js';
import '@ircam/sc-components/sc-text.js';
import '@ircam/sc-components/sc-toggle.js';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

async function main($container) {
  const config = loadConfig();
  const client = new Client(config);

  // Eventually register plugins
  // client.pluginManager.register('my-plugin', plugin);

  // cf. https://soundworks.dev/tools/helpers.html#browserlauncher
  launcher.register(client, { initScreensContainer: $container });

  const como = new ComoClient(client);
  await como.start();

  const playerStateMap = new Map();

  como.playerManager.players.onUpdate(async (player, updates) => {
    console.log(player.getValues());
    if (updates.scriptSharedStateClassName !== null) {
      const scriptState = await como.playerManager.getScriptSharedState(player.get('id'));
      playerStateMap.set(player, scriptState);
      scriptState.onUpdate(() => renderApp());
    } else if (updates.scriptSharedStateClassName === null) {
      playerStateMap.delete(player);
    }

    console.log(playerStateMap);
    renderApp();
  }, true);

  function renderApp() {
    let view = null;

    if (playerStateMap.size === 0) {
      view = html`
        <div class="simple-layout">
          <p>No device connected</p>
          <sw-credits .infos="${client.config.app}"></sw-credits>
        </div>
      `;
    } else {
      view = playerStateMap.entries().map(([player, scriptState]) => {
        return html`
          <div class="simple-layout">
            <div style="padding-bottom: 4px">
              <sc-text>sonificationVolume</sc-text>
              <sc-slider
                min=${scriptState.getDescription('sonificationVolume').min}
                max=${scriptState.getDescription('sonificationVolume').max}
                value=${scriptState.get('sonificationVolume')}
                @input=${e => scriptState.set('sonificationVolume', e.detail.value)}
              ></sc-slider>
            </div>
            <div style="padding-bottom: 4px">
              <sc-text>enableBackgroundSynth</sc-text>
              <sc-toggle
                ?active=${scriptState.get('enableBackgroundSynth')}
                @change=${e => scriptState.set('enableBackgroundSynth', e.detail.value)}
              ></sc-toggle>
            </div>

            <sw-credits .infos="${client.config.app}"></sw-credits>
          </div>
        `;
      });
    }

    render(view, $container);
  }

  renderApp();
}

// The launcher allows to launch multiple clients in the same browser window
// e.g. `http://127.0.0.1:8000?emulate=10` to run 10 clients side-by-side
launcher.execute(main, {
  numClients: parseInt(new URLSearchParams(window.location.search).get('emulate') || '') || 1,
});
