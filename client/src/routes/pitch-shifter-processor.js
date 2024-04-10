class PitchShifterProcessor extends AudioWorkletProcessor {
    process(inputs, outputs) {
      const input = inputs[0];
      const output = outputs[0];
  
      for (let channel = 0; channel < output.length; channel++) {
        const inputData = input[channel];
        const outputData = output[channel];
  
        for (let sample = 0; sample < inputData.length; sample++) {
          outputData[sample] = inputData[sample * 2] || 0;
        }
      }
  
      return true;
    }
  }
  
  registerProcessor('PitchShifterProcessor', PitchShifterProcessor);