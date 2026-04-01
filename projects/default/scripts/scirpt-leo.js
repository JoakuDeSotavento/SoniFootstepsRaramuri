import { startSoundbank, stopSoundBank, startWhiteNoise, stopWhiteNoise, createNoiseBuffer, playSampleWithEnvelope, playChordWithEnvelope, connectNodeToOtherNode } from "../lib/divers_synths";

//import * as THREE from 'three';

/**
 * Storing constants
 */

const {
  audioContext,
  audioBufferLoader,
  como,
} = getGlobalScriptingContext();

// Change this to switch the main metric used for volume mapping
// const metricVolume = 'quaternionDeviationAngleDeg'; 
const metricVolume = 'headingDeviation';

// parameters for the mapping (threshold values)
const paramsVolumeValid = { thresh1: 1, thresh2: 30, level1: 1, level2: 0.0001, base: 1, clip: false };
const paramsVolumeWhiteNoise = { thresh1: 30, thresh2: 1, level1: 0.2, level2: 0, base: 2 };
const paramsSensitivity = { thresh1: 1, thresh2: 0.1, level1: 2, level2: 90, base: 1, type: 'exponential' };
const paramsDeviationToPanning = { thresh1: -90, thresh2: 90, level1: -1, level2: 1, base: 10 };

const sourceDistance = 2; // Distance from listener to source in meters, used for panning calculations

const noteMappingAccompanying = {
  // 5: 'PianoC4.wav',
  10: '20-footsteps.mp3',
  20: '20-footsteps.mp3',
  30: '20-footsteps.mp3',
  40: '20-footsteps.mp3',
  50: '20-footsteps.mp3',
  60: '20-footsteps.mp3',
  70: '20-footsteps.mp3',
};

const noteMappingValidation = {
  0: '20-footsteps.mp3',
};

const chordMappingValidation = {
  0: ['20-footsteps.mp3', '20-footsteps.mp3', '20-footsteps.mp3'], // C major chord
};

// const noteMapping = {
//   10: 'bird-song.wav',
//   20: 'bird-1-note.wav',
// };

// ADSR Envelope parameters (in seconds)

const adsrParams = {
  attack: 0.02,    // Time to peak (20ms)
  decay: 0.1,      // Time to sustain level (100ms)
  sustain: 0.8,    // Sustain level (0-1)
  release: 0.2     // Time to fade out (200ms)
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

// Chord trigger tracking
let chordTriggerCount = 0;
let lastChordTriggerTime = 0;
const chordResetTimeout = 3000; // 5 seconds in milliseconds
const minChordVolume = 0.2;
const maxChordVolume = 1.0;

/**
 * Initializing variables
 

let euler = new THREE.Euler();

let quaternion = { x: 0, y: 0, z: 0, w: 1 };
let frameHeading = 0;
let frameOrientation = 0;
let framePitch = 0;
let frameRoll = 0;

let positionHeading = 0;
let positionOrientation = 0;
let positionRoll = 0;
let positionPitch = 0;
let positionQuaternion = { x: 0, y: 0, z: 0, w: 1 };

let headingDeviation = 0;
let headingDeviationInteger = 0;
let pitchDeviation = 0;
let rollDeviation = 0;
let orientationDeviation = 0;
let quaternionDeviation = 0;
let quaternionDeviationAngleDeg = 0;
*/
let gainValid = null;
let gainWhiteNoise = null;


/**
 * Return the description of a shared state, to dynamically create remote interfaces
 */
export async function defineSharedState(como) {
  return {
    classDescription: {
      startValidationTrack: {
        type: 'boolean',
        default: false,
      },
      startWhiteNoise: {
        type: 'boolean',
        default: false,
      },
      startNotesAccompanying: {
        type: 'boolean',
        default: false,
      },
      startNotesValidation: {
        type: 'boolean',
        default: false,
      },
      activatePanning: {
        type: 'boolean',
        default: false,
      },
      moveSource: {
        type: 'boolean',
        default: false,
      },
      recordPosition: {
        type: 'boolean',
        event: true,
      },
      frequency: {
        type: 'float',
        default: 4000,
        min: 20,
        max: 7000,
      },
      sensitivity: {
        type: 'float',
        default: 0.7,
        min: 0.1,
        max: 1,
      },
      volTest: {
        type: 'float',
        default: 0,
        min: 0,
        max: 1,
      },
      headingDeviation: {
        type: 'float',
        default: 0,
        min: -180,
        max: 180,
      },
      headingDeviationInteger: {
        type: 'integer',
        default: 0,
        min: -180,
        max: 180,
      }, pitchDeviation: {
        type: 'float',
        default: 0,
        min: -180,
        max: 180,
      },
      rollDeviation: {
        type: 'float',
        default: 0,
        min: -180,
        max: 180,
      },
      quaternion: {
        type: 'any',
        default: { x: 0, y: 0, z: 0, w: 1 },
      },
      quaternionDeviationAngleDeg: {
        type: 'float',
        default: 0,
        min: 0,
        max: 180
      },
    },
    initValues: {},
  };
}

function triggerNoteIfExistsAccompanying(state, context, output) {
  const noteNum = noteMappingAccompanying[Math.abs(state.get('headingDeviationInteger'))];
  // Route through piano panner if panning is active, otherwise use direct output
  const audioOutput = state.get('activatePanning') && context.pianoPanner ? context.pianoPanner : output;
  if (noteNum && context.samples && context.samples[noteNum]) playSampleWithEnvelope(audioContext, context.samples[noteNum], adsrParams, noteParams, audioOutput);
};

function triggerNoteIfExistsValidation(state, context, output) {
  const noteNum = noteMappingValidation[Math.abs(state.get('headingDeviationInteger'))];
  // Route through piano panner if panning is active, otherwise use direct output
  const audioOutput = state.get('activatePanning') && context.pianoPanner ? context.pianoPanner : output;
  if (noteNum && context.samples && context.samples[noteNum]) playSampleWithEnvelope(audioContext, context.samples[noteNum], adsrParams, noteParams, audioOutput);
};

function triggerChordIfExists(state, context, output) {
  const noteNames = chordMappingValidation[Math.abs(state.get('headingDeviationInteger'))];
  if (!noteNames) return;

  const now = Date.now();

  // Reset counter and volume if 5 seconds have passed since last trigger
  if (now - lastChordTriggerTime > chordResetTimeout) {
    chordTriggerCount = 0;
  }

  // Update last trigger time
  lastChordTriggerTime = now;

  // Calculate current volume based on trigger count
  // Linear decrease from maxChordVolume to minChordVolume
  const currentVolume = Math.max(minChordVolume, maxChordVolume - (chordTriggerCount * 0.2));

  // Increment trigger count
  chordTriggerCount++;

  // Gather buffers from samples for each note name in the chord
  const buffers = context.samples ? noteNames
    .map(name => context.samples[name])
    .filter(buffer => buffer) : [];  // Filter out undefined buffers

  // Route through piano panner if panning is active, otherwise use direct output
  const audioOutput = state.get('activatePanning') && context.pianoPanner ? context.pianoPanner : output;
  if (buffers.length > 0) {
    playChordWithEnvelope(audioContext, buffers, adsrParams, noteParams, audioOutput, currentVolume);
    console.log('Playing chord with', buffers.length, 'notes, volume:', currentVolume.toFixed(2), 'trigger count:', chordTriggerCount);
  }
};

/**
 * Function executed when the player enters the script
 */
export async function enter(context) {
  const { scriptName, output, state, soundbank, frame } = context;

  console.log('[script:enter]', scriptName);
  console.log(soundbank);

  // Initialize soundbank sources and samples fresh when entering script
  let soundbankSources = null;
  let soundbankSourcesRevel = null;
  let samples = null;

  // Initialize scalers when entering script
  
  // const soundscapeSynth = createLayerSynth(audioContext, "dyn-forest-1");
  // (await soundscapeSynth).connect(output);

  // create Revel test volume interaction gain nodes

  gainValid = new GainNode(audioContext);
  gainWhiteNoise = new GainNode(audioContext);
  const stereoPanner = new StereoPannerNode(audioContext);
  const binauralPanner = new PannerNode(audioContext, { panningModel: 'HRTF', distanceModel: 'inverse' });
  audioContext.listener.setPosition(0, 0, 0);
  audioContext.listener.setOrientation(0, 0, -1, 0, 1, 0); // Facing forward, up is positive Y

  const { sampleRate } = audioContext;

  // Set binauralPanner to a fixed position (source is in front of the listener)
  binauralPanner.positionX.setValueAtTime(0, audioContext.currentTime);
  binauralPanner.positionY.setValueAtTime(0, audioContext.currentTime);
  binauralPanner.positionZ.setValueAtTime(-2, audioContext.currentTime); // 2 meters in front

  // Create a separate panner node for piano samples that will follow head motion
  const pianoPanner = new PannerNode(audioContext, { panningModel: 'HRTF', distanceModel: 'inverse' });

  // Initialize piano panner at a neutral position (slightly in front and to the right)
  pianoPanner.positionX.setValueAtTime(1, audioContext.currentTime);
  pianoPanner.positionY.setValueAtTime(0, audioContext.currentTime);
  pianoPanner.positionZ.setValueAtTime(-1, audioContext.currentTime);

  // Load all samples from both mappings
  const allSampleNames = [
    ...Object.values(noteMappingAccompanying),
    ...Object.values(noteMappingValidation),
    ...Object.values(chordMappingValidation).flat()
  ];
  const uniqueSampleNames = [...new Set(allSampleNames)];
  samples = await como.soundbankManager.getBuffers(uniqueSampleNames);

  // Create notch filter
  const notchFilter = new BiquadFilterNode(audioContext);
  notchFilter.type = 'lowpass';
  notchFilter.Q.value = 3;
  notchFilter.frequency.value = state.get('frequency');


  // Create a white noise buffer
  const noiseBuffer = createNoiseBuffer(audioContext, sampleRate);

  gainValid.connect(output);
  notchFilter.connect(gainWhiteNoise);
  gainWhiteNoise.connect(output);
  binauralPanner.connect(output);
  pianoPanner.connect(output);

  // Storing useful variables in the context for access in other functions and cleanup on exit
  context.samples = samples; 
  context.gainValid = gainValid;
  context.gainWhiteNoise = gainWhiteNoise;
  context.binauralPanner = binauralPanner;
  context.stereoPanner = stereoPanner;
  context.pianoPanner = pianoPanner;
  gainWhiteNoise.gain.value = 0;
 
  context.soundbankSources = soundbankSources;
  context.soundbankSourcesRevel = soundbankSourcesRevel;
  context.sourceDistance = sourceDistance;

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
        case 'startWhiteNoise':
          value ? startWhiteNoise(audioContext, noiseBuffer, notchFilter) : stopWhiteNoise();
          break;
        case 'startNotesAccompanying':
          // value ? startWhiteNoise(audioContext, gainWhiteNoise, noiseBuffer) : stopWhiteNoise();
          break;
        case 'startNotesValidation':
          // value ? startWhiteNoise(audioContext, gainWhiteNoise, noiseBuffer) : stopWhiteNoise();
          break;
        case 'recordPosition':
          positionHeading = frameHeading;
          positionPitch = framePitch;
          positionRoll = frameRoll;
          positionOrientation = frameOrientation;
          positionQuaternion = quaternion;
          break;
        case 'frequency':
          if (notchFilter) {
            notchFilter.frequency.setTargetAtTime(value, audioContext.currentTime, 0.003);
          }
          break;
        
        
        default:
          break;
      }
    }
  });

  console.log('Script ready');
  // Save unsubscribe to context for cleanup on exit
  context.unsubscribe = unsubscribe;
}

/**
 * Called when exiting the script
 */
export async function exit(context) {
  const { scriptName, output, state, soundbank } = context;
  console.log('[script:exit]', scriptName);

  stopSoundBank(context.soundbankSourcesRevel);
  
  stopWhiteNoise();

 
stopSoundBank(context.soundbankSources);
if (context.unsubscribe) {
    context.unsubscribe();
    context.unsubscribe = null;
    }


  console.log('[script:exit]', scriptName);




  // Unsubscribe from state updatesd
  if (context.unsubscribe) {
    context.unsubscribe();
    context.unsubscribe = null;
  }
}

/**
 * Called at each motion frame
 */
export async function process(context, frame) {
  const { scriptName, output, state, soundbank, gainValid, gainAccomp, gainWhiteNoise } = context;


}