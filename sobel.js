const PNG = require('pngjs').PNG;
const fs = require('fs');
const moment = require('moment');
const { Worker } = require('worker_threads');

// Image slices
const threadCount = 2 || (require('os')).cpus().length;


/**
 * Boilerplate for promisifying threads
 * @param {Any} workerData 
 */
function runWorker(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./worker.js', { workerData });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0)
        reject(new Error(`Worker stopped with exit code ${code}`));
    })
  })
}

const png = new PNG({
  filterType: -1
});

let src, dst;
try {
  src = fs.createReadStream(process.argv[2]);
  dst = fs.createWriteStream(process.argv[3]);
} catch(err) {
  console.log(err);
  process.exit();
}

console.log('Processing image...');
const timeData = {
  startRead: moment().valueOf(),
  endRead: 0,
  endProcess: 0
}

// Image ready to be modified
png.on('parsed', async () => {
  timeData.endRead = moment().valueOf();
  
  const threads = new Array(threadCount).fill().map((item, index) => {
    return runWorker({
      index: index,
      pngData: png.data,
      fullWidth: png.width,
      fullHeight: png.height,
      height: (png.height / threadCount) * 1,
      width: (png.width / threadCount) * 1,
      startY: (png.height / threadCount) * index,
      endY: (png.height / threadCount) * (index + 1)
    });
  });

  // Await all threads to complete their work
  const res = await Promise.all(threads)
  
  timeData.endProcess = moment().valueOf();
  
  // exportPng(concatenate(Uint8Array, ...[res[0]]));
  exportPng(concatenate(Uint8Array, ...res));
  printStats();
});

/**
 * Export PNG Image
 * @param {Buffer} newData 
 */
const exportPng = (newData) => {
  png.data = newData;
  png.pack().pipe(dst);
}

const concatenate = (resultConstructor,...arrays) => {

  let totalLength = 0;
  for (let arr of arrays) {
    totalLength += arr.length;
  }

  let result = new resultConstructor(png.width * png.height * 4);
  let offset = (png.height / threadCount) * 4;

  for (let [index, arr] of arrays.entries()) {
    // result.set(arr);
    result.set(arr, offset * index);
    // offset += arr.length;
  }
  return result;
}

const printStats = () => {
  const loadTime = timeData.endRead - timeData.startRead
  const processTime = timeData.endProcess - timeData.endRead;
  console.log('Loaded ' + process.argv[2] + ' in ' + loadTime + 'ms, processed in ' + processTime + 'ms (' + numberWithCommas(Math.floor((png.width * png.height) / processTime) * 1000) + ' pixels/s)');
}

const numberWithCommas = (x) => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


src.pipe(png);
