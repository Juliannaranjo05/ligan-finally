const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  page.on('console', msg => {
    const text = msg.text();
    console.log('[BROWSER]', text);
  });

  page.on('pageerror', err => {
    console.error('[PAGE ERROR]', err.toString());
  });

  // Intercept responses to capture /api/wompi/packages
  await page.setRequestInterception(true);
  page.on('request', req => {
    req.continue();
  });

  page.on('response', async res => {
    try {
      const url = res.url();
      if (url.includes('/api/wompi/packages')) {
        const txt = await res.text();
        console.log('--- /api/wompi/packages response ---');
        console.log(txt.substring(0, 400));
        console.log('-----------------------------------');
      }
    } catch (e) {
      console.error('Error reading response', e);
    }
  });

  // Prepare localStorage
  const token = '548|ToH2p1LdtvDgLLhvT46CwpQkzK2NJaTs4EYHFktA';
  const user = { id: 49, name: 'E2E Test', role: 'cliente', rol: 'cliente' };

  await page.goto('about:blank');
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.removeItem('selected_country');
    console.log('[SETUP] localStorage set');
  }, { token, user });

  // Go to homecliente route
  const url = 'http://localhost:5173/homecliente';
  console.log('Navigating to', url);
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Wait for page to load and Buy Minutes button (text 'Comprar Minutos')
  try {
    const [buyBtn] = await page.$x("//button[contains(., 'Comprar Minutos') or contains(., 'buyMinutes') or contains(., 'Buy Minutes')]");
    if (buyBtn) {
      console.log('Found Comprar Minutos button, clicking');
      await buyBtn.click();
    } else {
      console.error('Comprar Minutos button not found');
      await browser.close();
      process.exit(1);
    }
  } catch (e) {
    console.error('Error finding buy button', e);
    await browser.close();
    process.exit(1);
  }

  // Wait for country selector modal (search input placeholder 'Buscar país...')
  try {
    await page.waitForSelector('input[placeholder="Buscar país..."]', { timeout: 5000 });
    console.log('Country selector shown');

    // Type blank to ensure list appears
    await page.click('input[placeholder="Buscar país..."]');

    // Click first country button in list
    await page.waitForSelector('div.max-h-[400px] button', { timeout: 5000 });
    const firstCountryBtn = await page.$('div.max-h-[400px] button');
    const countryText = await firstCountryBtn.evaluate(n => n.innerText);
    console.log('Clicking first country:', countryText.trim());
    await firstCountryBtn.click();

    // Wait for WompiPayment to appear and for /api/wompi/packages network response
    await page.waitForTimeout(2000);

    // Wait longer for package list
    await page.waitForSelector('div.grid', { timeout: 10000 }).catch(()=>console.log('Grid not found'));

    // Wait 3 seconds to capture console errors
    await page.waitForTimeout(3000);

  } catch (e) {
    console.error('Error interacting with country selector', e);
  }

  console.log('E2E run finished - closing browser');
  await browser.close();
})();
