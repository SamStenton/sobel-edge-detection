const { workerData, parentPort } = require('worker_threads')

const pngData = workerData.pngData;

// Clean workspace for new image (* 4 as RGBA)
const newData = Buffer.alloc(workerData.fullWidth * workerData.height * 4);

// Sobel Kernels https://en.wikipedia.org/wiki/Sobel_operator
const xKernels = [
  [-1, -2, -1],
  [0, 0, 0],
  [1, 2, 1]
];

const yKernels = [
  [-1, 0, 1],
  [-2, 0, 2],
  [-1, 0, 1]
];

const getBump = (x, y) => {
  let xbump = 0;
  let ybump = 0;
  for (let xOffset = -1; xOffset <= 1; xOffset++) {
    for (let yOffset = -1; yOffset <= 1; yOffset++) {

      // Get pixel location
      let idx = getIndex(x + xOffset, y + yOffset);

      let colorWeights = 0;
      for (let color = 0; color <= 2; color++) {
        if (pngData[idx + color]) {
          colorWeights += pngData[idx + color]
        } else {
          return 0;
        }
      }
      // Convert to greyscale
      const greyscale = Math.floor(colorWeights / 3);

      xbump += greyscale * xKernels[yOffset + 1][xOffset + 1];
      ybump += greyscale * yKernels[yOffset + 1][xOffset + 1];
    }
  }
  return Math.floor(Math.sqrt(Math.pow(xbump, 2) + Math.pow(ybump, 2)) / 3);
}

/**
 * Get pixel location within larger image
 */
const getIndex = (x, y) => {
  return (workerData.fullWidth * y + x) << 2;
}

for (let y = workerData.startY; y < workerData.endY; y++) {
  for (let x = 0; x < workerData.fullWidth; x++) {

    // Get real index as we're currently in a slice
    let index = getIndex(x, y);

    // Get gradients
    let bump = getBump(x, y);

    // Loop through RGBA
    for (let color = 0; color <= 2; color++) {
      newData[index + color] = bump;
    }
    // Set background seethrough
    newData[index + 3] = 255;
  }
}

// Respond back to main thread with data
parentPort.postMessage(newData);