export const concertDates = ['2026-10-24', '2026-10-25', '2026-10-30', '2026-10-31'];
export const ticketDefaults = { date: '2026-10-25', gate: '', level: '', block: '', row: '', seat: '' };
export const ticketFields = ['Gate', 'Level', 'Block', 'Row', 'Seat'];
export const creator = { name: 'Figma男人', url: 'https://www.xiaohongshu.com/user/profile/5fd0f2c00000000001009459' };
export const formatTicketDate = date => `${date.slice(8)} Oct ${date.slice(0, 4)}`;

// Draw immediately after the GPU frame, while its drawing buffer is available.
export function drawTicket(canvas, frame, details, hasMedia) {
  const ctx = canvas.getContext('2d');
  const red = '#c61e30', paper = '#eee8de', ink = '#130c10';
  ctx.setTransform(canvas.width / 1920, 0, 0, canvas.height / 1080, 0, 0);
  ctx.fillStyle = '#080607'; ctx.fillRect(0, 0, 1920, 1080);
  ctx.save(); ctx.translate(80, 150);
  ctx.fillStyle = paper; ctx.fillRect(0, 0, 1760, 780);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 570, 780); ctx.clip();
  ctx.fillStyle = '#100a0e'; ctx.fillRect(0, 0, 570, 780);
  if (hasMedia) {
    const scale = Math.max(570 / frame.width, 780 / frame.height);
    ctx.drawImage(frame, (570 - frame.width * scale) / 2, (780 - frame.height * scale) / 2, frame.width * scale, frame.height * scale);
  } else {
    ctx.save(); ctx.translate(36, 705); ctx.rotate(-Math.PI / 2);
    ctx.font = '170px Impact, "Arial Black", sans-serif'; ctx.fillStyle = red;
    ctx.fillText('AFTER HOURS', 0, 175, 670); ctx.restore();
  }
  ctx.fillStyle = red; ctx.fillRect(0, 0, 8, 780);
  ctx.fillStyle = paper; ctx.font = '18px Arial, "Microsoft YaHei", sans-serif';
  ctx.fillText('AFTERIMAGE / 余像', 30, 744);
  ctx.restore();

  const text = (value, x, y, font, color = ink, width) => {
    ctx.font = font; ctx.fillStyle = color;
    if (width) ctx.fillText(value, x, y, width); else ctx.fillText(value, x, y);
  };
  text('THE', 612, 66, 'bold 28px Arial');
  text('WEEKND', 606, 195, '150px Impact, "Arial Black", sans-serif', red, 710);
  text('After Hours', 612, 264, 'bold 55px Georgia, serif');
  text('Til Dawn Tour', 612, 328, 'bold 55px Georgia, serif');
  ctx.strokeStyle = '#b7aaa3'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(612, 359); ctx.lineTo(1308, 359); ctx.stroke();
  text('HONG KONG', 612, 405, 'bold 30px Arial', red);
  text('KAI TAK STADIUM', 612, 450, 'bold 28px Arial');
  text('啟德主場館 / 启德主场馆', 612, 485, '22px "Microsoft YaHei", sans-serif');
  text(formatTicketDate(details.date), 612, 548, 'bold 35px Arial');
  const values = ticketFields.map(label => String(details[label.toLowerCase()] || '—').toUpperCase());
  ticketFields.forEach((label, i) => {
    const x = 612 + i * 142;
    text(label.toUpperCase(), x, 605, '17px Arial', '#705b60');
    text(values[i], x, 653, 'bold 35px Arial', ink, 122);
  });
  text(`小红书 @${creator.name}`, 612, 710, '18px Arial, "Microsoft YaHei", sans-serif', '#705b60');
  text('FAN-MADE SOUVENIR / 演出纪念票根', 612, 744, '16px Arial, "Microsoft YaHei", sans-serif', '#705b60');

  ctx.fillStyle = red; ctx.fillRect(1360, 0, 400, 780);
  ctx.strokeStyle = paper; ctx.setLineDash([8, 9]); ctx.beginPath(); ctx.moveTo(1360, 20); ctx.lineTo(1360, 760); ctx.stroke(); ctx.setLineDash([]);
  text('HKG', 1398, 158, '110px Impact, "Arial Black", sans-serif', paper, 320);
  text('THE WEEKND', 1402, 218, 'bold 28px Arial', paper);
  text('AFTER HOURS TIL DAWN', 1402, 254, '17px Arial', paper);
  const [year, , day] = details.date.split('-');
  text(`${day} Oct`, 1398, 362, 'bold 72px Arial', paper, 320);
  text(year, 1404, 402, '22px Arial', paper);
  ticketFields.forEach((label, i) => {
    text(label.toUpperCase(), 1404, 467 + i * 40, '17px Arial', paper);
    text(values[i], 1540, 467 + i * 40, 'bold 23px Arial', paper, 165);
  });
  text('KAI TAK / 香港', 1404, 744, '18px Arial, "Microsoft YaHei", sans-serif', paper);
  ctx.fillStyle = '#080607';
  for (const y of [0, 780]) { ctx.beginPath(); ctx.arc(1360, y, 19, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

export function saveTicket(canvas, date, onError, onSave) {
  // Export just the ticket itself, without the preview's surrounding black margin.
  const image = document.createElement('canvas'); image.width = 1760; image.height = 780;
  image.getContext('2d').drawImage(canvas, 80 / 1920 * canvas.width, 150 / 1080 * canvas.height,
    1760 / 1920 * canvas.width, 780 / 1080 * canvas.height, 0, 0, 1760, 780);
  image.toBlob(blob => {
    if (!blob) { onError('票根图片生成失败，请重试。'); return; }
    if (onSave) { onSave(blob, `afterimage-hong-kong-${date}.png`); return; }
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `afterimage-hong-kong-${date}.png`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
