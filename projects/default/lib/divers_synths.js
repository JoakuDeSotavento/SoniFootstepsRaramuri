// load and play buffers selcted from the sound bank // 

import { decibelToLinear } from '@ircam/sc-utils';


export function startSoundbank(audioContext, soundbank, output) {
    if (Object.keys(soundbank).length === 0) {
        return;
    }

    // 1. Create a "Private" gain node just for this bank
    const bankGain = new GainNode(audioContext);
    bankGain.gain.value = 0.01; // Set this to your desired volume (0.0 to 1.0)
    bankGain.connect(output);

    const soundbankSources = {};

    Object.keys(soundbank).forEach(function (key) {
        const source = new AudioBufferSourceNode(audioContext, {
            buffer: soundbank[key],
            loop: false,
        });
        
        // 2. Connect source to the Private gain, NOT directly to output
        source.connect(bankGain);
        source.start();
        
        soundbankSources[key] = source;
    });

    return soundbankSources;
}

/** export function startSoundbank(audioContext, soundbank, output) {
    if (Object.keys(soundbank).length === 0) {
        return;
    }

    const soundbankSources = {};

    Object.keys(soundbank).forEach(function (key) {
        soundbankSources[key] = new AudioBufferSourceNode(audioContext, {
            buffer: soundbank[key],
            loop: false,
        });
        soundbankSources[key].connect(output);
        soundbankSources[key].start();
    });

    return soundbankSources;
}

*/
export function stopSoundBank(soundbankSources) {
    if (soundbankSources === null) {
        return;
    }
    Object.keys(soundbankSources).forEach(function (key) {
        soundbankSources[key].stop();
        soundbankSources[key].disconnect();
    });
}

// create, load and play a white noise buffer //

let whiteNoiseSource = null;

export function startWhiteNoise(audioContext, noiseBuffer, gainWhiteNoise) {
    whiteNoiseSource = audioContext.createBufferSource();
    whiteNoiseSource.buffer = noiseBuffer;
    whiteNoiseSource.loop = true;
    whiteNoiseSource.connect(gainWhiteNoise);
    whiteNoiseSource.start();
    console.log('white noise started')
}

export function createNoiseBuffer(audioContext, sampleRate) {
    const noiseBuffer = audioContext.createBuffer(1, 10 * sampleRate, sampleRate);
    const noiseBufferSamples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBufferSamples.length; i++) {
        noiseBufferSamples[i] = 2 * Math.random() - 1;
    }
    return noiseBuffer;
}

export function stopWhiteNoise() {
    if (whiteNoiseSource) {
        whiteNoiseSource.stop();
        whiteNoiseSource.disconnect();
        whiteNoiseSource = null;
        console.log('white noise stopped')
    }
}

export function playSampleWithEnvelope(audioContext, buffer, adsrParams, noteParams, output) {
    if (!buffer) return;
    
    // Create source and gain node for envelope
    const source = audioContext.createBufferSource();
    const envelopeGain = audioContext.createGain();
    
    source.buffer = buffer;
    source.loop = true;
    
    // Connect: source -> envelopeGain -> output
    source.connect(envelopeGain);
    envelopeGain.connect(output);
    
    // Use configured note duration instead of full buffer
    const noteDuration = noteParams.duration;
    const currentTime = audioContext.currentTime;
    
    // Calculate actual envelope times
    const attackTime = Math.min(adsrParams.attack, noteDuration * 0.1);
    const decayTime = Math.min(adsrParams.decay, noteDuration * 0.2);
    const releaseTime = Math.min(adsrParams.release, noteDuration * 0.2);
    const sustainStart = currentTime + attackTime + decayTime;
    const sustainDuration = noteDuration - attackTime - decayTime - releaseTime;
    
    // Apply ADSR envelope
    envelopeGain.gain.setValueAtTime(0, currentTime);                                      // Start at 0
    envelopeGain.gain.linearRampToValueAtTime(1, currentTime + attackTime);               // Attack to 1
    envelopeGain.gain.linearRampToValueAtTime(adsrParams.sustain, currentTime + attackTime + decayTime); // Decay to sustain
    
    if (sustainDuration > 0) {
      envelopeGain.gain.setValueAtTime(adsrParams.sustain, sustainStart);                 // Hold sustain
    }
    
    envelopeGain.gain.linearRampToValueAtTime(0, currentTime + noteDuration + releaseTime); // Release to 0
    
    // Start playback from noteParams.startTime, stop after noteDuration
    source.start(0, noteParams.startTime);
    source.stop(currentTime + noteDuration + releaseTime);
};


export function playSample(audioContext, buffer, triggerDelay, output, volume) {
    if (!buffer) return;    
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    source.buffer = buffer;
    source.loop = true; 
    //gainNode.gain.value = decibelToLinear(volumeDb);    
    gainNode.gain.value = volume;    
    
    source.connect(gainNode);
    gainNode.connect(output);    
    const currentTime = audioContext.currentTime;
    const startTime = currentTime + triggerDelay;
        // Start at the calculated time
    source.start(startTime);
    // Stop after the buffer duration
    source.stop(startTime + buffer.duration);
};

export function playChordWithEnvelope(audioContext, buffers, adsrParams, noteParams, output, volume = 1.0) {
    if (!buffers || buffers.length === 0) return;
    
    // Use configured note duration
    const noteDuration = noteParams.duration;
    const currentTime = audioContext.currentTime;
    
    // Calculate envelope times (same for all notes in chord)
    const attackTime = Math.min(adsrParams.attack, noteDuration * 0.1);
    const decayTime = Math.min(adsrParams.decay, noteDuration * 0.2);
    const releaseTime = Math.min(adsrParams.release, noteDuration * 0.2);
    const sustainStart = currentTime + attackTime + decayTime;
    const sustainDuration = noteDuration - attackTime - decayTime - releaseTime;
    
    // Play each buffer in the chord
    buffers.forEach((buffer) => {
        if (!buffer) return;
        
        // Create source and gain node for each note
        const source = audioContext.createBufferSource();
        const envelopeGain = audioContext.createGain();
        
        source.buffer = buffer;
        source.loop = false;
        
        // Connect: source -> envelopeGain -> output
        source.connect(envelopeGain);
        envelopeGain.connect(output);
        
        // Apply ADSR envelope with volume scaling
        envelopeGain.gain.setValueAtTime(0, currentTime);
        envelopeGain.gain.linearRampToValueAtTime(volume, currentTime + attackTime);
        envelopeGain.gain.linearRampToValueAtTime(adsrParams.sustain * volume, currentTime + attackTime + decayTime);
        
        if (sustainDuration > 0) {
            envelopeGain.gain.setValueAtTime(adsrParams.sustain * volume, sustainStart);
        }
        
        envelopeGain.gain.linearRampToValueAtTime(0, currentTime + noteDuration + releaseTime);
        
        // Start playback from noteParams.startTime, stop after noteDuration
        source.start(0, noteParams.startTime);
        source.stop(currentTime + noteDuration + releaseTime);
    });
};

export function connectNodeToOtherNode(node, pannerNode) {
  if (node) {
    node.disconnect();
    node.connect(pannerNode);
  }
}