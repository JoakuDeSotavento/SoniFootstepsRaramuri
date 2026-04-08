import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import { loadConfig, launcher } from '@soundworks/helpers/browser.js';
import { html, render, nothing } from 'lit';

import ComoClient from '@ircam/como/ComoClient.js';

import '@ircam/sc-components/sc-icon.js';
import '@ircam/sc-components/sc-midi.js';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

async function main($container) {
  const config = loadConfig();
  const client = new Client(config);

  // cf. https://soundworks.dev/tools/helpers.html#browserlauncher
  launcher.register(client, {
    initScreensContainer: $container,
    reloadOnVisibilityChange: false,
  });

  const como = new ComoClient(client);
  await como.start();


/** 
// --- NEW: Observe the session state to catch the save trigger ---
  como.project.subscribe(async () => {
  const sessionIds = como.project.get('sessionIds'); 
  for (let id of sessionIds) {
    const session = await como.project.getSession(id);
    
    // Listen for the saveRequest we sent from the script
    session.onUpdate(updates => {
      if (updates.saveRequest) {
        console.log("Controller received data!", updates.saveRequest);
        downloadBlobAsFile(updates.saveRequest.filename, updates.saveRequest.text);
      }
    });
  }
});

*/

  const controller = await como.stateManager.create('controller', {
    showEditScriptPanel: false,
  });

  controller.onUpdate(renderApp, true);

  function renderApp() {
    render(html`
      <div class="controller-layout">
        <header>
          <h1>${client.config.app.name} | ${client.role}</h1>
          <div style="display: flex;">
            <sc-midi></sc-midi>
            <como-project-manager .como=${como}></como-project-manager>
            <sc-icon
              type="prompt"
              ?active=${controller.get('showEditScriptPanel')}
              @input=${e => controller.set('showEditScriptPanel', !controller.get('showEditScriptPanel'))}
            ></sc-icon>
            <sw-audit .client="${client}"></sw-audit>
          </div>
        </header>
        <section>
          <como-session-manager expanded .como=${como}></como-session-manager>
          <como-source-manager .como=${como}></como-source-manager>
          <como-player-manager .como=${como} expanded></como-player-manager>
          ${controller.get('showEditScriptPanel')
            ? html`<como-script-manager .como=${como}></como-script-manager>`
            : nothing
          }
        </section>
      </div>
    `, $container);
  }
}

launcher.execute(main, {
  numClients: parseInt(new URLSearchParams(window.location.search).get('emulate') || '') || 1,
  width: '50%',
});



/**
 * NEW Triggers a browser download for a text string
 
function downloadBlobAsFile(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = `${filename}.txt`;
  
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  console.log(`[Controller] Download triggered for: ${filename}.txt`);
}

*/