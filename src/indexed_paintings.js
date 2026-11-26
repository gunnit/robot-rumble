'use strict';

// Indexed pixels paint synchronously in both the offline game and the canvas harness.
function indexedPaintings(width, height, panels) {
  const cache = [];
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function decode(encoded) {
    const bytes = new Uint8Array(Math.floor(encoded.length * 3 / 4));
    let buffer = 0, bits = 0, write = 0;
    for (let i = 0; i < encoded.length; i++) {
      const digit = alphabet.indexOf(encoded[i]);
      if (digit < 0) break;
      buffer = (buffer << 6) | digit;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes[write++] = (buffer >> bits) & 255;
      }
    }
    return bytes;
  }
  function get(index) {
    if (!panels[index]) return null;
    if (cache[index]) return cache[index];
    const [colors, image] = panels[index].map(decode);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    const frame = g.createImageData(width, height);
    for (let p = 0; p < width * height; p++) {
      const color = image[p] * 3, pixel = p * 4;
      frame.data[pixel] = colors[color];
      frame.data[pixel + 1] = colors[color + 1];
      frame.data[pixel + 2] = colors[color + 2];
      frame.data[pixel + 3] = 255;
    }
    g.putImageData(frame, 0, 0);
    cache[index] = canvas;
    return canvas;
  }
  return {get};
}
