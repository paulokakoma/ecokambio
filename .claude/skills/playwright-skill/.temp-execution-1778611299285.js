const { chromium } = require('playwright')

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000'

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // Track Monetag network requests
  const monetagRequests = []
  page.on('request', req => {
    if (req.url().includes('quge5.com') || req.url().includes('monetag')) {
      monetagRequests.push({ url: req.url(), status: 'requested' })
    }
  })
  page.on('requestfailed', req => {
    if (req.url().includes('quge5.com') || req.url().includes('monetag')) {
      monetagRequests.push({ url: req.url(), status: 'failed', error: req.failure().errorText })
    }
  })
  page.on('response', res => {
    if (res.url().includes('quge5.com') || res.url().includes('monetag')) {
      monetagRequests.push({ url: res.url(), status: res.status() })
    }
  })

  const filesToCheck = ['/', '/login.html', '/faq.html', '/produtos.html']

  for (const file of filesToCheck) {
    console.log(`\n🔍 Checking ${TARGET_URL}${file}...`)
    try {
      await page.goto(`${TARGET_URL}${file}`, { waitUntil: 'domcontentloaded', timeout: 15000 })
      
      // Check Meta Tag
      const metaTag = await page.$('meta[name="monetag"]')
      const metaContent = metaTag ? await metaTag.getAttribute('content') : null
      console.log(`   Meta tag: ${metaContent ? '✅ ' + metaContent : '❌ Not found'}`)

      // Check Script Tag
      const scriptTag = await page.$('script[src*="quge5.com"]')
      if (scriptTag) {
        const src = await scriptTag.getAttribute('src')
        const zone = await scriptTag.getAttribute('data-zone')
        const asyncAttr = await scriptTag.getAttribute('async')
        console.log(`   Script tag: ✅ src=${src}, zone=${zone}, async=${asyncAttr !== null}`)
      } else {
        console.log(`   Script tag: ❌ Not found`)
      }

      // Wait a bit for network requests
      await page.waitForTimeout(3000)
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`)
    }
  }

  console.log('\n📡 Monetag Network Requests:')
  if (monetagRequests.length === 0) {
    console.log('   No requests to quge5.com detected (expected if server is local)')
  } else {
    monetagRequests.forEach(r => console.log(`   ${r.url} => ${r.status}`))
  }

  console.log('\n✅ Verification complete')
  await browser.close()
})()
