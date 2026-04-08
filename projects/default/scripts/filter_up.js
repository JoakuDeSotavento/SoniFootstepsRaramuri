/**
 * Return the description of a shared state, to dynamically create remote interfaces
 * cf. https://soundworks.dev/soundworks/global.html#SharedStateClassDescription
 *
// * @param {*} como - instance of the como node
 */
import { startSoundbank, stopSoundBank, playSampleWithEnvelope, playSample } from '../lib/divers_synths.js';


const {
  audioContext,
  audioBufferLoader,
  como,
} = getGlobalScriptingContext();

let samples = null;

const footstepsBank = {
  1:  '14-chord2.mp3',
  4: 'control_frame_aspL1.wav',
  5: 'low_frame_aspL1.wav',
  6: 'high_frame_aspL1.wav',
  1: 'control_frame_aspR1.wav',
  2: 'low_frame_aspR1.wav',
  3: 'high_frame_aspR1.wav',
};


const adsrParams = {
  attack: 0.01,    // Time to peak (20ms)
  decay: 0.1,      // Time to sustain level (100ms)
  sustain: 0.8,    // Sustain level (0-1)
  release: 0.3     // Time to fade out (200ms)
};

// Note parameters

// const noteParams = {
//   duration: 0.8,   // Duration of each note (500ms)
//   startTime: 0     // Start offset in sample (0 = beginning)
// };

const noteParams = {
  duration: 0.8,   // Duration of each note (500ms)
  startTime: 0     // Start offset in sample (0 = beginning)
};


let gainValid = null;
export async function defineSharedState(como) {
  return {
    classDescription: {

      startValidationTrack: {
        type: 'boolean',
        default: false,
      },
      // triggerFootstepFrame: {
      //       type: 'boolean',
      //        event: true,

      //    },

    invertThreshold: {
        type: 'boolean',
        default: false,
      },

      gyroThreshold: {
        type: 'float',
        default: 2,
        min: 0,
        max: 4,
      },

      delay: {
        type: 'float',
        default: 0,
        min: 0,
        max: 200,
      },

      condition: {
        type: 'enum',
        list: [1, 2, 3],
        default: 1,
      },

      eventLeft: {
        type: 'boolean',
        event: true,
      },

      eventRight: {
        type: 'boolean',
        event: true,
      },


    },
    initValues: {},
  };
}

// define your global variables
// define you audio routing
// define mapping with shared state

/**
 * Function executed when the player enters the script
 */
export async function enter(context) {
  const { scriptName, output, state, soundbank, frame } = context;

  // define mappings between the state and analysis / synthesis

  console.log('[script:enter]', scriptName);
  console.log(soundbank);

  // Initialize soundbank sources and samples fresh when entering script
  let samples = null;

  let soundbankSources = null;
  let gyroThresholdValue = 2;
  let triggerDelay = 0;
  let condition = 1;
  // Initialize scalers when entering script

  const gainValid = new GainNode(audioContext);

  const allSampleNames = [
    ...Object.values(footstepsBank),
  ];
  const uniqueSampleNames = [...new Set(allSampleNames)];
  samples = await como.soundbankManager.getBuffers(uniqueSampleNames);

  gainValid.connect(output);

  context.samples = samples;
  context.gainValid = gainValid;
  context.gyroThresholdValue = gyroThresholdValue;
  context.triggerDelay = triggerDelay;
  context.soundbankSources = soundbankSources;
  context.condition = condition;
  context.soundbankSources = startSoundbank(audioContext, soundbank, gainValid);

  /** Listen for shared state changes */
  context.unsubscribe = state.onUpdate((newValues, oldValues) => {
    for (let [key, value] of Object.entries(newValues)) {
      switch (key) {
        case 'startValidationTrack':
          if (value && context.soundbankSources === null) {
            context.soundbankSources = startSoundbank(audioContext, soundbank, gainValid);
          } else if (!value && context.soundbankSources !== null) {
            stopSoundBank(context.soundbankSources);
            context.soundbankSources = null;
          } break;
        case 'gyroThreshold':
          context.gyroThresholdValue = value;
          break;
        case 'delay':
          context.triggerDelay = value;
          break;
        case 'condition':
          context.condition = value;
          break;
        default:
          break;
      }
    }
  });

  console.log('Script ready, # smaples', context.samples.length);
}

export async function exit(context) {
  const { scriptName, output, state, soundbank } = context;
  console.log('[script:exit]', scriptName);

  stopSoundBank(context.soundbankSources);
  context.unsubscribe();

  console.log('[script:exit]', scriptName);
}



export async function process(context, frame) {
  const { scriptName, output, state, soundbank, gainValid, gainAccomp, gainWhiteNoise } = context;

  // 1. Raw inputs
  let rawL = frame[1].gyroscope.z;
  let rawR = -1 * frame[0].gyroscope.z; // Normalizing Right to be positive
  let triggerDelayS = context.triggerDelay;
  let conditionSet = context.condition;

  // 2. Initialize Persistent State
  if (state.lastSide === undefined) state.lastSide = null;
  if (state.filteredL === undefined) state.filteredL = 0;
  if (state.filteredR === undefined) state.filteredR = 0;
  if (state.isInSwingL === undefined) state.isInSwingL = false;
  if (state.isInSwingR === undefined) state.isInSwingR = false;

  // 3. APPLY LOW-PASS FILTER (The Smoothing)
  // Formula: filtered = (old_filtered * (1 - alpha)) + (new_raw * alpha)
  const alpha = 0.5; // Smoothing factor (0.05 to 0.3 is typical)
  state.filteredL = (state.filteredL * (1 - alpha)) + (rawL * alpha);
  state.filteredR = (state.filteredR * (1 - alpha)) + (rawR * alpha);

  // --- TRIGGER LEFT (Using Filtered Signal) ---
  if (state.filteredL > context.gyroThresholdValue && !state.isInSwingL) {
    state.isInSwingL = true; // "Lock" the trigger until the movement ends
    
    setTimeout(() => {
      playSample(audioContext, context.samples[footstepsBank[1 + conditionSet - 1]], 0, output);
    }, triggerDelayS);

    state.set('eventLeft', true);
    console.log('[script:process] Filtered Trigger LEFT');
  }

  // RESET: Only allow Left to trigger again once it drops below a "safe" level
  if (state.filteredL < (context.gyroThresholdValue * 0.2)) {
    state.isInSwingL = false;
  }

  // --- TRIGGER RIGHT (Using Filtered Signal) ---
  if (state.filteredR > context.gyroThresholdValue && !state.isInSwingR) {
    state.isInSwingR = true; // "Lock" the trigger
    
    setTimeout(() => {
      playSample(audioContext, context.samples[footstepsBank[4 + conditionSet - 1]], 0, output);
    }, triggerDelayS);

    state.set('eventRight', true);
    console.log('[script:process] Filtered Trigger RIGHT');
  }

  // RESET: Only allow Right to trigger again once it drops below a "safe" level
  if (state.filteredR < (context.gyroThresholdValue * 0.2)) {
    state.isInSwingR = false;
  }
}