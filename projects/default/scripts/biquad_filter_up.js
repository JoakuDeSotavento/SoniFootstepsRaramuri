/**
 * Return the description of a shared state, to dynamically create remote interfaces
 * cf. https://soundworks.dev/soundworks/global.html#SharedStateClassDescription
 *
// * @param {*} como - instance of the como node
 */
import { startSoundbank, stopSoundBank, playSampleWithEnvelope, playSample } from '../lib/divers_synths.js';

import { Lowpass } from '@ircam/sc-signal';

const {
  audioContext,
  audioBufferLoader,
  como,
} = getGlobalScriptingContext();

let samples = null;

const footstepsBank = {

  14: 'control_frame_aspL1.wav',
  15: 'low_frame_aspL1.wav',
  16: 'high_frame_aspL1.wav',
  11: 'control_frame_aspR1.wav',
  12: 'low_frame_aspR1.wav',
  13: 'high_frame_aspR1.wav',

  24: 'control_frame_aspL2.wav',
  25: 'low_frame_aspL2.wav',
  26: 'high_frame_aspL2.wav',
  21: 'control_frame_aspR2.wav',
  22: 'low_frame_aspR2.wav',
  23: 'high_frame_aspR2.wav',

  34: 'control_frame_aspL3.wav',
  35: 'low_frame_aspL3.wav',
  36: 'high_frame_aspL3.wav',
  31: 'control_frame_aspR3.wav',
  32: 'low_frame_aspR3.wav',
  33: 'high_frame_aspR3.wav',

  44: 'control_frame_aspL4.wav',
  45: 'low_frame_aspL4.wav',
  46: 'high_frame_aspL4.wav',
  41: 'control_frame_aspR4.wav',
  42: 'low_frame_aspR4.wav',
  43: 'high_frame_aspR4.wav',

  54: 'control_frame_aspL5.wav',
  55: 'low_frame_aspL5.wav',
  56: 'high_frame_aspL5.wav',
  51: 'control_frame_aspR5.wav',
  52: 'low_frame_aspR5.wav',
  53: 'high_frame_aspR5.wav',

  64: 'control_frame_aspL6.wav',
  65: 'low_frame_aspL6.wav',
  66: 'high_frame_aspL6.wav',
  61: 'control_frame_aspR6.wav',
  62: 'low_frame_aspR6.wav',
  63: 'high_frame_aspR6.wav',

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

      limitGatems: {
        type: 'float',
        default: 0,
        min: 0,
        max: 500,
      },


      condition: {
        type: 'enum',
        list: ['Control', 'Low-Frequency', 'High-Frequency'],
        default: 'Control',
      },
    
      volumeC: {
        type: 'float',
        default: 0,
        min: -6,
        max: 0,
      },
      
      volumeLF: {
        type: 'float',
        default: -3,
        min: -6,
        max: 0,
      },

      volumeHF: {
        type: 'float',
        default: 0,
        min: -6,
        max: 0,
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





/**
 * Function executed when the player enters the script
 */
export async function enter(context) {
  const { scriptName, output, state, soundbank, frame } = context;

  console.log('[script:enter]', scriptName);
  console.log(soundbank);

  // Initialize soundbank sources and samples fresh when entering script
  let samples = null;

  let soundbankSources = null;
  let gyroThresholdValue = 2;
  let triggerDelay = 0;
  let condition= 1;
  let limitGatems = 0;
  let randomFrame=0;
  let volumeC=0;
  let volumeHF=0;
  let volumeLF=0;
  let volumeCond=0;
  const conditionConfigs = {
    'Control': { id: 1, volKey: 'volumeC' },
    'Low-Frequency': { id: 2, volKey: 'volumeLF' },
    'High-Frequency': { id: 3, volKey: 'volumeHF' }
  };
  // Initialize scalers when entering script

  // const soundscapeSynth = createLayerSynth(audioContext, "dyn-forest-1");
  // (await soundscapeSynth).connect(output);

  // create Revel test volume interaction gain nodes

  gainValid = new GainNode(audioContext);



  const allSampleNames = [
    ...Object.values(footstepsBank),
  ];
  const uniqueSampleNames = [...new Set(allSampleNames)];
  samples = await como.soundbankManager.getBuffers(uniqueSampleNames);





  gainValid.connect(output);
  state.samples = samples;

  //state.gainValid = gainValid;
  state.gyroThresholdValue = gyroThresholdValue;
  state.triggerDelay = triggerDelay;

  state.soundbankSources = soundbankSources;

  
  state.condition = condition;
  state.limitGatems = limitGatems;
  state.volumeC = volumeC;
  state.volumeLF = volumeLF;
  state.volumeHF = volumeHF;
  state.randomFrame = randomFrame;
  state.volumeCond = volumeCond;
  /** Listen for shared state changes */
  const unsubscribe = state.onUpdate((newValues, oldValues) => {
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
          state.gyroThresholdValue = value;
          break;
        case 'delay':
          state.triggerDelay = value;
          break;
        case 'condition': {
          const config = conditionConfigs[value];
          state.condition = config.id;
          state.volumeCond = state.get(config.volKey);
          break;
        }
        case 'limitGatems':
          state.limitGatems = value;
          break;
          
        case 'volumeC':
        case 'volumeLF':
        case 'volumeHF': {
          // If the slider being moved matches the current active condition, update context.volumeCond
          const currentConfig = conditionConfigs[state.get('condition')];
          if (key === currentConfig.volKey) {
            state.volumeCond = value;
         }
        break;
            }
        default:
          break;
      }
    }
  });





  console.log(state.samples);

  console.log('Script ready');
  // Save unsubscribe to context for cleanup on exit
  context.unsubscribe = unsubscribe;


const sampleRate = 100; 
const cutOff = 10; 
  state.lowpassL = new Lowpass(sampleRate,cutOff);
  state.lowpassR = new Lowpass(sampleRate,cutOff);
 

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
  let triggerDelayS = state.triggerDelay;
  let conditionSet = state.condition;

  // 2. Initialize Persistent State
  if (state.lastSide === undefined) state.lastSide = null;
  if (state.filteredL === undefined) state.filteredL = 0;
  if (state.filteredR === undefined) state.filteredR = 0;
  if (state.isInSwingL === undefined) state.isInSwingL = false;
  if (state.isInSwingR === undefined) state.isInSwingR = false;
  
  // NEW: Initialize timestamp tracking
  if (state.lastTriggerTime === undefined) state.lastTriggerTime = 0;

  // APPLY LOW-PASS FILTER
 
    state.filteredL = state.lowpassL.process(rawL,100,10);
    state.filteredR = state.lowpassR.process(rawR,100,10);


  const now = Date.now();
  const minInterval = state.limitGatems; // The limitGatems rule

  // --- TRIGGER LEFT ---
  if (state.filteredL > state.gyroThresholdValue && !state.isInSwingL) {
    // Only proceed if 300ms has passed since ANY previous trigger
    if (now - state.lastTriggerTime > minInterval) {
      state.isInSwingL = true;
      state.lastTriggerTime = now; // Record this trigger time

      state.randomFrame = Math.floor(Math.random() * 6) + 1;

      setTimeout(() => {
        playSample(audioContext, state.samples[footstepsBank[state.randomFrame*10+ 1 + conditionSet - 1]], 0, output,state.volumeCond);
      }, triggerDelayS);

      state.set('eventLeft', true);
      console.log('[script:process] Filtered Trigger LEFT', state.randomFrame*10+ 1 + conditionSet - 1,state.volumeCond);
    }
  }

  // RESET LEFT
  if (state.filteredL < (state.gyroThresholdValue * 0.4)) {
    state.isInSwingL = false;
  }

  // --- TRIGGER RIGHT ---
  if (state.filteredR > state.gyroThresholdValue && !state.isInSwingR) {
    // Only proceed if 300ms has passed since ANY previous trigger
    if (now - state.lastTriggerTime > minInterval) {
      state.isInSwingR = true;
      state.lastTriggerTime = now; // Record this trigger time

      setTimeout(() => {
        playSample(audioContext, state.samples[footstepsBank[state.randomFrame*10+  4 + conditionSet - 1]], 0, output,state.volumeCond);
      }, triggerDelayS);

      state.set('eventRight', true);
      console.log('[script:process] Filtered Trigger RIGHT',state.randomFrame*10+ 4 + conditionSet - 1);
    }
  }

  // RESET RIGHT
  if (state.filteredR < (state.gyroThresholdValue * 0.4)) {
    state.isInSwingR = false;
  }
}