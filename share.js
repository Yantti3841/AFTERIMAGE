import { creator } from './ticket';

export function downloadFile(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function shareFile(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'AFTERIMAGE · 余像' });
  } else downloadFile(blob, name);
}

export function makePoster(frame, ticket, effect) {
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1440;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#080607'; ctx.fillRect(0, 0, 1080, 1440);
  ctx.fillStyle = '#d81e30'; ctx.font = '900 148px Impact, Arial Black, sans-serif';
  ctx.fillText('AFTERIMAGE', 48, 174, 984);
  ctx.fillStyle = '#f1eee8'; ctx.font = '24px Arial, Microsoft YaHei, sans-serif';
  ctx.fillText('余像 / AFTER HOURS TIL DAWN', 52, 229);
  // Keep the full artwork visible; the surround is designed for a 3:4 feed.
  const area = ticket ? { x: 48, y: 470, w: 984, h: 436 } : { x: 48, y: 302, w: 984, h: 832 };
  const sw = ticket ? frame.width * 1760 / 1920 : frame.width;
  const sh = ticket ? frame.height * 780 / 1080 : frame.height;
  const sx = ticket ? frame.width * 80 / 1920 : 0, sy = ticket ? frame.height * 150 / 1080 : 0;
  const scale = Math.min(area.w / sw, area.h / sh), w = sw * scale, h = sh * scale;
  ctx.drawImage(frame, sx, sy, sw, sh, area.x + (area.w - w) / 2, area.y + (area.h - h) / 2, w, h);
  ctx.strokeStyle = '#573036'; ctx.strokeRect(48, 278, 984, 880);
  ctx.fillStyle = '#d81e30'; ctx.font = 'bold 44px Arial, Microsoft YaHei, sans-serif';
  ctx.fillText(ticket ? 'HONG KONG · 纪念票根' : effect, 52, 1230);
  ctx.fillStyle = '#f1eee8'; ctx.font = '26px Arial, Microsoft YaHei, sans-serif';
  ctx.fillText('THE WEEKND / KAI TAK STADIUM', 52, 1282);
  ctx.fillStyle = '#b3a3a5'; ctx.font = '22px Arial, Microsoft YaHei, sans-serif';
  ctx.fillText(`小红书 @${creator.name}  /  FAN-MADE VISUAL LAB`, 52, 1378);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片生成失败，请重试。')), 'image/png'));
}
