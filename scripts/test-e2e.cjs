const http = require('http');

async function main() {
  console.log('Connecting to Chrome CDP...');
  // 1. Create a new target
  const newTargetRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:5173', { method: 'PUT' });
  const target = await newTargetRes.json();
  console.log('Opened target:', target.id, target.webSocketDebuggerUrl);

  const ws = new WebSocket(target.webSocketDebuggerUrl);

  let messageId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
  };

  const send = (method, params = {}) => {
    const id = messageId++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await new Promise((resolve) => (ws.onopen = resolve));
  console.log('WebSocket connected. Enabling Page & Runtime...');

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  // Wait for initial page load
  await new Promise((r) => setTimeout(r, 2000));

  console.log('Checking initial page title and heading...');
  let evalRes = await send('Runtime.evaluate', {
    expression: 'document.title + " | " + document.querySelector("h1")?.innerText',
  });
  console.log('Initial page evaluation:', evalRes.result?.value);

  // Click the "Quick Demo" button or the first sample sheet
  console.log('Clicking sample sheet / Quick Demo...');
  evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Quick Demo'));
      if (btn) {
        btn.click();
        return 'Clicked Quick Demo';
      }
      return 'Button not found';
    })()`,
  });
  console.log('Click result:', evalRes.result?.value);

  await new Promise((r) => setTimeout(r, 1500));

  // Check chords before transposition (Original in C: C, G, Am, F)
  evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const badges = Array.from(document.querySelectorAll('.font-mono')).map(el => el.textContent.trim()).filter(Boolean);
      return {
        toolbarText: document.querySelector('.text-indigo-400')?.textContent,
        sampleBadges: badges.slice(0, 10)
      };
    })()`,
    returnByValue: true,
  });
  console.log('Original chords state:', JSON.stringify(evalRes.result?.value));

  // Click "1 Key Lower (-2)"
  console.log('Clicking "1 Key Lower (-2)" button...');
  evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const lowerBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('1 Key Lower'));
      if (lowerBtn) {
        lowerBtn.click();
        return 'Clicked 1 Key Lower';
      }
      return '1 Key Lower button not found';
    })()`,
  });
  console.log('Click 1 Key Lower result:', evalRes.result?.value);

  await new Promise((r) => setTimeout(r, 1000));

  // Check transposed chords
  evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const badges = Array.from(document.querySelectorAll('.font-mono')).map(el => el.textContent.trim()).filter(Boolean);
      const isBbPresent = badges.some(b => b.includes('Bb') || b.includes('B♭'));
      return {
        semitoneIndicator: document.querySelector('.font-mono.font-extrabold')?.textContent,
        isBbPresent,
        sampleBadges: badges.slice(0, 10)
      };
    })()`,
    returnByValue: true,
  });
  console.log('Transposed (-2 semitones) state:', JSON.stringify(evalRes.result?.value));

  // Take screenshot of transposed sheet
  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  if (screenshotRes.result?.data) {
    const fs = require('fs');
    fs.writeFileSync('/workspace/screenshot-transposed.png', Buffer.from(screenshotRes.result.data, 'base64'));
    console.log('Saved screenshot of transposed music sheet to /workspace/screenshot-transposed.png');
  }

  // Close target and ws
  ws.close();
  await fetch(`http://127.0.0.1:9222/json/close/${target.id}`, { method: 'PUT' });
  console.log('E2E Test completed successfully!');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
