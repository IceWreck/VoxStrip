export const getDominantColors = (img: HTMLImageElement): Promise<string[]> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(['#1a1a1a', '#2d2d2d', '#404040']);
      return;
    }

    canvas.width = 100;
    canvas.height = 100;
    ctx.drawImage(img, 0, 0, 100, 100);

    const imageData = ctx.getImageData(0, 0, 100, 100);
    const data = imageData.data;

    const colorMap: Record<string, number> = {};

    for (let i = 0; i < data.length; i += 4) {
      const r = Math.round(data[i] / 32) * 32;
      const g = Math.round(data[i + 1] / 32) * 32;
      const b = Math.round(data[i + 2] / 32) * 32;
      const key = `${r},${g},${b}`;
      colorMap[key] = (colorMap[key] || 0) + 1;
    }

    const sortedColors = Object.entries(colorMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([color]) => {
        const [r, g, b] = color.split(',').map(Number);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      });

    if (sortedColors.length === 0) {
      resolve(['#1a1a1a', '#2d2d2d', '#404040']);
      return;
    }

    resolve(sortedColors);
  });
};
