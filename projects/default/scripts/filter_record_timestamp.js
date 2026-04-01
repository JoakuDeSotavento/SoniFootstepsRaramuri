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

      recordingName: {
        type: 'string',
        default: 'my-recording'+ new Date().toISOString().slice(0, 16).replace(/[:T]/g, '_'),
      },

      isRecording: {
        type: 'boolean',
        default: false,
      },
      
      saveRequest: {
        type: 'any',
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
  let limitGatems = 0;
 let randomFrame=0;


let recordingName = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '_');
let eventLog = []; // To store { timestamp, side, label }
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
context.limitGatems = limitGatems;
context.recordingName = recordingName;
context.eventLog = eventLog;


context.randomFrame = randomFrame;


context.soundbankSources = startSoundbank(audioContext, soundbank, gainValid);




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

      
      case 'limitGatems':
          context.limitGatems = value;
          break;

          
          case 'recordingName':
        context.recordingName = value;
        break;

      // New: Handle the Start/Stop recording toggle
      case 'isRecording':
  context.isRecording = value;
  if (value === false) {
    console.log(">>> Recording Stopped. Sending data to controller...");
    
    // Create the string from your eventLog array
    const logContent = eventLog.map(e => `[${e.time}] ${e.side}: ${e.sample}`).join('\n');
    
    // THIS LINE IS KEY: It must match the name in your defineSharedState
    state.set('saveRequest', {
      filename: recordingName,
      text: logContent
    });
  }
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


function saveLogToFile(name, logArray) {
  if (logArray.length === 0) {
      console.log("[Recording] No events to save.");
      return;
  }

  // 1. Prepare the text content
  const header = `Recording Session: ${name}\n` +
                 `Date: ${new Date().toString()}\n` +
                 `-------------------------------------------\n`;

  const body = logArray.map(entry => 
      `[${entry.time}] SIDE: ${entry.side.padEnd(6)} | SAMPLE: ${entry.sample}`
  ).join('\n');

  const fullContent = header + body;

  // 2. Ensure the directory exists
  const dirPath = path.join(process.cwd(), 'recordings');
  if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
  }

  // 3. Define the full file path
  const fileName = `${name.replace(/[^a-z0-9_\-]/gi, '_')}.txt`;
  const filePath = path.join(dirPath, fileName);

  // 4. Write to disk
  fs.writeFile(filePath, fullContent, 'utf8', (err) => {
      if (err) {
          console.error(`[Error] Failed to save recording:`, err);
      } else {
          console.log(`[Success] Log saved to: ${filePath}`);
      }
  });
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
  
  // NEW: Initialize timestamp tracking
  if (state.lastTriggerTime === undefined) state.lastTriggerTime = 0;

  // 3. APPLY LOW-PASS FILTER
  const alpha = 0.3;
  state.filteredL = (state.filteredL * (1 - alpha)) + (rawL * alpha);
  state.filteredR = (state.filteredR * (1 - alpha)) + (rawR * alpha);

  const now = Date.now();
  const minInterval = context.limitGatems; // The limitGatems rule

  // --- TRIGGER LEFT ---
  if (state.filteredL > context.gyroThresholdValue && !state.isInSwingL) {
    // Only proceed if 300ms has passed since ANY previous trigger
    if (now - state.lastTriggerTime > minInterval) {
      state.isInSwingL = true;
      state.lastTriggerTime = now; // Record this trigger time
      context.randomFrame = Math.floor(Math.random() * 6) + 1;
    const sampleId = context.randomFrame * 10 + 1 + conditionSet - 1;


    if (context.isRecording) {
        context.eventLog.push({
          time: new Date().toISOString(),
          side: 'Left',
          sample: sampleId
        });
      }



      setTimeout(() => {
        playSample(audioContext, context.samples[footstepsBank[context.randomFrame*10+ 1 + conditionSet - 1]], 0, output);
      }, triggerDelayS);

      state.set('eventLeft', true);
      console.log('[script:process] Filtered Trigger LEFT', context.randomFrame*10+ 1 + conditionSet - 1);
    }
  }

  // RESET LEFT
  if (state.filteredL < (context.gyroThresholdValue * 0.4)) {
    state.isInSwingL = false;
  }

  // --- TRIGGER RIGHT ---
  if (state.filteredR > context.gyroThresholdValue && !state.isInSwingR) {
    // Only proceed if 300ms has passed since ANY previous trigger
    if (now - state.lastTriggerTime > minInterval) {
      state.isInSwingR = true;
      state.lastTriggerTime = now; // Record this trigger time

    const sampleId = context.randomFrame * 10 + 4 + conditionSet - 1;

      // NEW: Log event if recording is active
      if (context.isRecording) {
        context.eventLog.push({
          time: new Date().toISOString(),
          side: 'Right',
          sample: sampleId
        });
    }


      setTimeout(() => {
        playSample(audioContext, context.samples[footstepsBank[context.randomFrame*10+  4 + conditionSet - 1]], 0, output);
      }, triggerDelayS);

      state.set('eventRight', true);
      console.log('[script:process] Filtered Trigger RIGHT',context.randomFrame*10+ 4 + conditionSet - 1);
    }
  }

  // RESET RIGHT
  if (state.filteredR < (context.gyroThresholdValue * 0.4)) {
    state.isInSwingR = false;
  }
}

