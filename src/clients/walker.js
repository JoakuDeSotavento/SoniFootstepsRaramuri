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
                ?number-box=${true}  
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



            <div style="padding-bottom: 4px">
              <sc-text>gyroThreshold</sc-text>
              <sc-slider
                ?number-box=${true}  
                min=${scriptState.getDescription('gyroThreshold').min}
                max=${scriptState.getDescription('gyroThreshold').max}
                value=${scriptState.get('gyroThreshold')}
                @input=${e => scriptState.set('gyroThreshold', e.detail.value)}
              ></sc-slider>
            </div>



            <div style="padding-bottom: 4px">
              <sc-text>delay</sc-text>
              <sc-slider
                ?number-box=${true}
                min=${scriptState.getDescription('delay').min}
                max=${scriptState.getDescription('delay').max}
                value=${scriptState.get('delay')}
                @input=${e => scriptState.set('delay', e.detail.value)}
              ></sc-slider>
            </div>

            <div style="padding-bottom: 4px">
              <sc-text>limitGatems</sc-text>
              <sc-slider
                ?number-box=${true}
                min=${scriptState.getDescription('limitGatems').min}
                max=${scriptState.getDescription('limitGatems').max}
                value=${scriptState.get('limitGatems')}
                @input=${e => scriptState.set('limitGatems', e.detail.value)}
              ></sc-slider>
            </div>

            <div style="padding-bottom: 4px">
              <sc-text>backgroundSynthVolume</sc-text>
              <sc-slider
                ?number-box=${true}  
                min=${scriptState.getDescription('backgroundSynthVolume').min}
                max=${scriptState.getDescription('backgroundSynthVolume').max}
                value=${scriptState.get('backgroundSynthVolume')}
                @input=${e => scriptState.set('backgroundSynthVolume', e.detail.value)}
              ></sc-slider>
            </div>



            <div style="padding-bottom: 10px">
              <sc-text>Background Synth Soundbank</sc-text>
              <sc-select
                .options=${[
                  'ambient', 'ambient-nature-1', 'ambient-nature-2', 'duel-elec-1', 
                  'duel-elec-2', 'dyn-forest-1', 'dyn-forest-2', 'dyn-mer-1', 
                  'dyn-mer-2', 'elec-beat-1', 'elec-beat-2', 'elec-forest-1', 
                  'elec-forest-2', 'elec-marche-1', 'elec-marche-2', 'gare-mer-1', 
                  'gare-mer-2', 'inst', 'marche-nature-1', 'marche-nature-2', 
                  'memory-elec', 'memory-forest', 'memory-nature-night', 
                  'memory-nature-sea', 'memory-test', 'memory-urban-out', 
                  'memory-urban-subway', 'nature-foret', 'nature-foret-simple', 
                  'nature-mer', 'nature-nuit', 'textes'
                ]}
                .value=${scriptState.get('backgroundSynthSoundbank') || 'nature-foret'}
                @change=${e => scriptState.set('backgroundSynthSoundbank', e.detail.value)}
              ></sc-select>
            </div>

            <div style="padding-bottom: 4px">
  <sc-text>condition</sc-text>
  <sc-radio
    .options=${['Control', 'Low-Frequency', 'High-Frequency']}  
    @change=${e => scriptState.set('condition', e.detail.value)}
  ></sc-radio>
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
