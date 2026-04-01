/**
 * Return the description of a shared state, to dynamically create remote interfaces
 * cf. https://soundworks.dev/soundworks/global.html#SharedStateClassDescription
 *
 * @param {*} como - instance of the como node
 */
import { startSoundbank, stopSoundBank} from '../lib/divers_synths.js';


export async function defineSharedState(como) {
  return {
    classDescription: {

        startFootstepFrame: {
            type: 'boolean',
            default: false,
        },
        triggerFootstepFrame: {
            type: 'boolean',
            event: true,
        },

        thresholdSlider: {
            type: 'float',
            default: 0,
            min:0,
            max:2,

        },


        


    },
    // initValues:  { play: false },
  };
}

/**
 * Function executed when the player enters the script
 * @param {*} context
 */
export async function enter(context) {


  let soundbankSources = null;

  const { scriptName, audioContext, outputNode, sharedState, soundbank } = context;
  console.log('[script:enter]', scriptName);
  console.log('[script:process]]', soundbank);

context.soundbankSources = soundbankSources;


/** Listen for shared state changes */
  const unsubscribe = state.onUpdate((newValues, oldValues) => {
    for (let [key, value] of Object.entries(newValues)) {
      switch (key) {
        case 'startFootstepFrame':
          if (value && context.soundbankSources === null) {
            context.soundbankSources = startSoundbank(audioContext, soundbank, gainValid);
          } else if (!value && context.soundbankSources !== null) {
            stopSoundBank(context.soundbankSources);
            context.soundbankSources = null;
          } break;
        
        default:
          break;
      }
    }
  });


  context.unsubscribe= unsubscribe;





}

/**
 * Function executed when the player exits the script
 * @param {*} context
 */


 
 
export async function exit(context) {
  const { scriptName, audioContext, outputNode, sharedState, soundbank } = context;

stopSoundBank(context.soundbankSources);
if (context.unsubscribe) {
    context.unsubscribe();
    context.unsubscribe = null;
    }


  console.log('[script:exit]', scriptName);
}

/**
 * Function executed on each frame of the player motion data source.
 * Note that frame is multi channel even if it contains only one source
 * @param {*} context
 */

//console.log('[script:process]]', frame[0].gyroscope);




//}

