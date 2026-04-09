/**
 * Return the description of a shared state, to dynamically create remote interfaces
 * cf. https://soundworks.dev/soundworks/global.html#SharedStateClassDescription
 *
// * @param {*} como - instance of the como node
 */
import { startSoundbank, stopSoundBank, playSampleWithEnvelope, playSample } from '../lib/divers_synths.js';
import { createLayerSynth, list } from '../../../synths/layer-synth/layer-synth.js';
import { decibelToLinear } from '@ircam/sc-utils';

import { Lowpass } from '@ircam/sc-signal';

const {
  audioContext,
  audioBufferLoader,
  como,
} = getGlobalScriptingContext();

let unsubscribeSharedState;
let samples = null;
let soundbankSources = null;
let randomFrame = 0;

const conditionConfigs = {
  'Control': { volKey: 'volumeC', volume: 0 },
  'Low-Frequency': { volKey: 'volumeLF', volume: 0 },
  'High-Frequency': { volKey: 'volumeHF', volume: 0 }
};
const sampleRate = 100;
const cutOff = 10;
let lowpassL = new Lowpass(sampleRate, cutOff);
let lowpassR = new Lowpass(sampleRate, cutOff);

let sonificationGain = null;
let backgroundGain = null;
let backgroundSynth = null;


let filteredL = 0;
let filteredR = 0;
let isInSwingL = false;
let isInSwingR = false;

let writer;

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
      sonificationVolume: {
        type: 'float',
        default: 0,
        min: -80,
        max: 12,
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
      // background synth stuff
      enableBackgroundSynth: {
        type: 'boolean',
        default: false,
      },
      backgroundSynthVolume: {
        type: 'float',
        default: 0,
        min: -80,
        max: 12,
      },
      backgroundSynthSoundbank: {
        type: 'enum',
        default: 'nature-foret',
        list: list,
      },
    },
    initValues: {},
  };
}

/**
 * Function executed when the player enters the script
 */
export async function enter(context) {
  const { scriptName, output, state, soundbank } = context;

  console.log('[script:enter]', scriptName);
  // create Revel test volume interaction gain nodes
  sonificationGain = new GainNode(audioContext);
  sonificationGain.connect(output);

  backgroundGain = new GainNode(audioContext);
  backgroundGain.connect(output);

  const allSampleNames = Object.values(footstepsBank);
  const uniqueSampleNames = [...new Set(allSampleNames)];

  samples = await como.soundbankManager.getBuffers(uniqueSampleNames);

  /** Listen for shared state changes */
  unsubscribeSharedState = state.onUpdate(async (newValues, oldValues) => {
    for (let [key, value] of Object.entries(newValues)) {
      switch (key) {
        case 'startValidationTrack': {
          if (value && soundbankSources === null) {
            soundbankSources = startSoundbank(audioContext, soundbank, output);
          } else if (!value && soundbankSources !== null) {
            stopSoundBank(soundbankSources);
            soundbankSources = null;
          }
          break;
        }
        case 'sonificationVolume': {
          const gain = decibelToLinear(value);
          sonificationGain.gain.setTargetAtTime(gain, audioContext.currentTime, 0.005);
          break;
        }
        case 'volumeC': {
          conditionConfigs['Control'].volume = value;
          break;
        }
        case 'volumeLF': {
          conditionConfigs['Low-Frequency'].volume = value;
          break;
        }
        case 'volumeHF': {
          conditionConfigs['High-Frequency'].volume = value;
          break;
        }
        case 'backgroundSynthVolume': {
          const gain = decibelToLinear(value);
          backgroundGain.gain.setTargetAtTime(gain, audioContext.currentTime, 0.005);
          break;
        }
        case 'enableBackgroundSynth':
        case 'backgroundSynthSoundbank': {
          if (backgroundSynth) {
            backgroundSynth.stop();
            backgroundSynth = null;
          }

          if (state.get('enableBackgroundSynth')) {
            const soundbank = state.get('backgroundSynthSoundbank');
            backgroundSynth = await createLayerSynth(audioContext, audioBufferLoader, soundbank);
            backgroundSynth.connect(backgroundGain);
            backgroundSynth.start();
          }
          break;
        }
        default:
          break;
      }
    }
  }, true);

  // console.log(samples);

  // create a writer for logs
  // writer = await como.logger.createWriter(`${scriptName}.txt`, { bufferSize: 100 });

  // setInterval(() => {
  //   const someData = {
  //     timestamp: como.sync.getSyncTime(),
  //     x: Math.random(),
  //     y: Math.random(),
  //     z: Math.random(),
  //   }
  //   writer.write(JSON.stringify(someData));
  // }, 100);

  console.log('Script ready');

}

export async function exit(context) {
  const { scriptName, output, state, soundbank } = context;
  console.log('[script:exit]', scriptName);

  unsubscribeSharedState();
  // close the writer,
  console.log('close writer');
  if (writer) {
    await writer.close();
  }

  console.log('stop soundbank');
  stopSoundBank(soundbankSources);

  if (backgroundSynth) {
    console.log('stop background synth');
    backgroundSynth.stop();
  }
}

export async function process(context, frame) {
  const { scriptName, output, state, soundbank } = context;

  // 1. Raw inputs
  let rawL = frame[1].gyroscope.z;
  let rawR = -1 * frame[0].gyroscope.z; // Normalizing Right to be positive

  // NEW: Initialize timestamp tracking
  if (lastTriggerTime === undefined) lastTriggerTime = 0;

  // APPLY LOW-PASS FILTER
  filteredL = lowpassL.process(rawL,100,10);
  filteredR = lowpassR.process(rawR,100,10);

  const now = Date.now();
  const condition = state.get('condition');
  const limitGatems = state.get('limitGatems');
  const delay = state.get('delay');
  const gyroThreshold = state.get('gyroThreshold');
  const conditionOffset = Object.keys(conditionConfigs).indexOf(condition) + 1;
  const volume = conditionConfigs[condition].volume;

  // --- TRIGGER LEFT ---
  if (filteredL > gyroThreshold && !isInSwingL) {
    // Only proceed if 300ms has passed since ANY previous trigger
    if (now - lastTriggerTime > limitGatems) {
      isInSwingL = true;
      lastTriggerTime = now; // Record this trigger time

      randomFrame = Math.floor(Math.random() * 6) + 1;

      setTimeout(() => {
        playSample(audioContext, samples[footstepsBank[randomFrame * 10 + 1 + conditionOffset - 1]], 0, sonificationGain, volume);
      }, delay);

      state.set('eventLeft', true);
      console.log('[script:process] Filtered Trigger LEFT', randomFrame * 10 + 1 + conditionOffset - 1, volume);
    }
  }

  // RESET LEFT
  if (filteredL < (gyroThreshold * 0.4)) {
    isInSwingL = false;
  }

  // --- TRIGGER RIGHT ---
  if (filteredR > gyroThreshold && !isInSwingR) {
    // Only proceed if 300ms has passed since ANY previous trigger
    if (now - lastTriggerTime > limitGatems) {
      isInSwingR = true;
      lastTriggerTime = now; // Record this trigger time

      setTimeout(() => {
        playSample(audioContext, samples[footstepsBank[randomFrame * 10 +  4 + conditionOffset - 1]], 0, sonificationGain, volume);
      }, delay);

      state.set('eventRight', true);
      console.log('[script:process] Filtered Trigger RIGHT',randomFrame * 10 + 4 + conditionOffset - 1);
    }
  }

  // RESET RIGHT
  if (filteredR < (gyroThreshold * 0.4)) {
    isInSwingR = false;
  }
}
