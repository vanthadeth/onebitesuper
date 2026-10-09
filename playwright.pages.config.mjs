import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
 testDir:'./tests',testMatch:'pages.spec.ts',reporter:'list',
 use:{headless:true,launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox','--disable-dev-shm-usage']},trace:'retain-on-failure'},
 projects:[{name:'phone',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}},{name:'desktop',use:{viewport:{width:1440,height:1000}}}],
 webServer:process.env.PAGES_TEST_BASE_URL?undefined:{command:'npm run preview:pages',url:'http://127.0.0.1:5185/onebitesuper/',reuseExistingServer:true},
});
