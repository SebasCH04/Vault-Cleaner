// Set VC_BROWSER_EXECUTABLE to test with a locally installed Chrome/Chromium.
if (process.env.VC_BROWSER_EXECUTABLE) {
  module.exports = {args:['--no-sandbox','--disable-dev-shm-usage'],executablePath:async()=>process.env.VC_BROWSER_EXECUTABLE};
} else {
  const imported = require('@sparticuz/chromium');
  module.exports = imported.default || imported;
}
