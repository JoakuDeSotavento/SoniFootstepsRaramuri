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
        type: 'integer',
        default: 2,
        min: 1,
        max: 3,
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
  let soundbankSourcesRevel = null;
  let gyroThresholdValue = 2;
  let triggerDelay = 0;
  let condition= 1;
  // Initialize scalers when entering script

  // const soundscapeSynth = createLayerSynth(audioContext, "dyn-forest-1");
  // (await soundscapeSynth).connect(output);

  // create Revel test volume interaction gain nodes

  gainValid = new GainNode(audioContext);

  const { sampleRate } = audioContext;




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
  context.soundbankSourcesRevel = soundbankSourcesRevel;
context.condition = condition;

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
          context.gyroThresholdValue = value;
          //context.gyroThresholdValue.set({ inputEnd: gyroThresholdValuesc });
          // context.headingDeviationToWhiteNoiseVolume.set({ inputEnd: sensitivityValue });
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





  console.log(context.samples);

  console.log('Script ready');
  // Save unsubscribe to context for cleanup on exit
  context.unsubscribe = unsubscribe;



}




export async function exit(context) {
  const { scriptName, output, state, soundbank } = context;
  console.log('[script:exit]', scriptName);

  stopSoundBank(context.soundbankSourcesRevel);



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

export async function process(context, frame) {
  const { scriptName, output, state, soundbank, gainValid, gainAccomp, gainWhiteNoise } = context;

  let valueTriggerL = frame[1].gyroscope.z;
  let valueTriggerR = frame[0].gyroscope.z;
  let triggerDelayS = context.triggerDelay;
  let conditionSet = context.condition; 

  // --- INITIALIZE LOCAL TRACKING (Persists between frames) ---
  if (state.isInSwingL === undefined) state.isInSwingL = false;
  if (state.currentMaxL === undefined) state.currentMaxL = 0;
  if (state.isInSwingR === undefined) state.isInSwingR = false;
  if (state.currentMaxR === undefined) state.currentMaxR = 0;

  // --- TRIGGER LEFT ---
  if (valueTriggerL > context.gyroThresholdValue) {
    state.isInSwingL = true;
    if (valueTriggerL > state.currentMaxL) {
      state.currentMaxL = valueTriggerL;
    }
  }

  // Trigger when velocity drops to 10% of peak
  if (state.isInSwingL && valueTriggerL < (state.currentMaxL * 0.1)) {
    console.log('[script:process] Triggered LEFT (Peak detected)');
    
    // We removed the "state.lastSide !== 'left'" check here
    setTimeout(() => {
      playSample(audioContext, context.samples[footstepsBank[1 + conditionSet - 1]], 0, output);
    }, triggerDelayS);

    state.set('eventLeft', true);
    
    // Reset for next swing
    state.isInSwingL = false;
    state.currentMaxL = 0;
  }

  // --- TRIGGER RIGHT ---
  const normalizedR = -1 * valueTriggerR;
  if (normalizedR > context.gyroThresholdValue) {
    state.isInSwingR = true;
    if (normalizedR > state.currentMaxR) {
      state.currentMaxR = normalizedR;
    }
  }

  // Trigger when velocity drops to 10% of peak
  if (state.isInSwingR && normalizedR < (state.currentMaxR * 0.1)) {
    console.log('[script:process] Triggered RIGHT (Peak detected)');
    
    // We removed the "state.lastSide !== 'right'" check here
    playSample(audioContext, context.samples[footstepsBank[4 + conditionSet - 1]], 0, output);
    
    state.set('eventRight', true);

    // Reset for next swing
    state.isInSwingR = false;
    state.currentMaxR = 0;
  }
}