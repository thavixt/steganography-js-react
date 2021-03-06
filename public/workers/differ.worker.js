// @ts-nocheck
// eslint-disable

const LOG_FREQUENCY = 50;

/**
 * Compare two images pixel-by-pixel and return an image with the differing pixels highlighted
 * @param {{buffer: ArrayBuffer, width: number, height: number}} firstImage 
 * @param {{buffer: ArrayBuffer, width: number, height: number}} secondImage
 * @param {{r: number, g: number, b: number, a: number}} diffColor
 */
function compareImages(
    firstImage,
    secondImage,
    diffColor = { r: 255, g: 20, b: 144, a: 255 },
) {
    const start = performance.now();
    self.postMessage({ progressBar: 0 });

    // Create a view (iterable array) of the transferred arrayBuffer object
    const firstView = new Uint8ClampedArray(firstImage.buffer);
    const secondView = new Uint8ClampedArray(secondImage.buffer);

    // Determine which image to base the diff on
    // NOTE: For now, only allow same-size images
    if (firstView.length !== secondView.length) {
        // Operation not allowed - size difference
        console.error("Process aborted. Error: SIZE_DIFFERENCE");
        // Transfer the first image back to the main thread
        self.postMessage({
            error: "SIZE_DIFFERENCE",
            type: "image",
            mode: "image",
        }, []);
        return false;
    }

    // Check if the diffColor is appropriate
    const diffColors = constrainColor(diffColor);
    const LOGINTERVAL = (firstView.length / LOG_FREQUENCY).toFixed() * 2;

    for (let index = 0; index < firstView.length; index += 4) {
        // Process the two pixels at the same index
        let newPixel = diffPixels(
            [
                firstView[index],
                firstView[index + 1],
                firstView[index + 2],
                firstView[index + 3],
            ],
            [
                secondView[index],
                secondView[index + 1],
                secondView[index + 2],
                secondView[index + 3],
            ],
            diffColors,
        );

        if (!!newPixel) {
            // Set the new pixel
            firstView[index] = newPixel[0];
            firstView[index + 1] = newPixel[1];
            firstView[index + 2] = newPixel[2];
            firstView[index + 3] = newPixel[3];
        }

        if (index % LOGINTERVAL === 0) {
            self.postMessage(
                { progressBar: (100 * index / firstView.length).toFixed(1) },
            );
        }
    }

    const time = (performance.now() - start).toFixed();

    // Transfer resulting arrayBuffer back to the main thread
    self.postMessage({
        done: time,
        type: "image",
        mode: "DEFAULT", // TODO: Set modes
        diffColor: diffColors,
        result: {
            width: firstImage.width,
            height: firstImage.height,
            buffer: firstView.buffer,
            byteLength: firstView.buffer.byteLength,
        },
    }, [firstView.buffer]);
}

/**
 * Compare two pixels. If they're not equal, returin a pixel based on the diffColor parameter.
 * @param {number[]} firstPixel 
 * @param {number[]} secondPixel
 * @param {number[]} diffColor
 * @return {number[] | boolean}
 */
function diffPixels(firstPixel, secondPixel, diffColor) {
    const areEqual =
        firstPixel.sort().toString() === secondPixel.sort().toString();
    if (areEqual) {
        return false;
    } else {
        // TODO: blend colors
        //return [100, 0, 100, 255];
        return blendPixels(firstPixel, diffColor);
    }
}

/**
 * Combine (additive mode) two RGBA colors.
 * @param {number[]} base
 * @param {number[]} added
 * @return {number[]}
 */
function blendPixels(base, added) {
    const mix = [0, 0, 0, 0];
    // Calculate the blended color
    mix[0] = averageColor(base[0], added[0]);
    mix[1] = averageColor(base[1], added[1]);
    mix[2] = averageColor(base[2], added[2]);
    mix[3] = averageColor(base[2], added[2]);
    return constrainColor({
        r: mix[0],
        g: mix[1],
        b: mix[2],
        a: mix[3],
    });
}

/**
 * Average two color values.
 * @param {number} color1 
 * @param {number} color2 
 * @param {number} [magnitude=1] 
 * @returns {number}
 */
function averageColor(color1, color2, magnitude = 1) {
    return parseInt(((color1 + color2) / 2 * magnitude).toFixed());
}

/**
 * Constrain the RGBA values and return an array containing four valid number values.
 * @param {{r: number, g: number, b: number, a: number}} diffColorObj
 * @return {number[]}
 */
function constrainColor(diffColorObj) {
    const constrainRGBA = (value) => Math.min(Math.max(parseInt(value), 0), 255);
    const red = constrainRGBA(diffColorObj.r);
    const green = constrainRGBA(diffColorObj.g);
    const blue = constrainRGBA(diffColorObj.b);
    const alpha = constrainRGBA(diffColorObj.a);
    return [red, green, blue, alpha];
}

/**
 * Handle messages coming from the main thread
 * @param {Object} e event data
 * @param {array} transferList of ArrayBuffers
 */
function handler(e, transferList) {
    if (e.data.mode == "image") {
        compareImages(e.data.first, e.data.second, e.data.diffColor);
    } else {
        console.error("No compatible process type found.");
    }
    return;
}
self.onmessage = handler;
