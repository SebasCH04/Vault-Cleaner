(() => {
  'use strict';
  if (globalThis.browser) return;
  const api = globalThis.chrome;

  function sendError(sendResponse,error) {
    sendResponse({vcError:error?.message || 'The background request failed.'});
  }

  globalThis.browser = {
    storage:api.storage,
    tabs:api.tabs,
    alarms:api.alarms,
    runtime:{
      getURL:path=>api.runtime.getURL(path),
      getManifest:()=>api.runtime.getManifest(),
      async sendMessage(message) {
        const reply = await api.runtime.sendMessage(message);
        if (reply?.vcError) throw new Error(reply.vcError);
        return reply;
      },
      onMessage:{
        addListener(listener) {
          api.runtime.onMessage.addListener((message,sender,sendResponse)=>{
            try {
              const result = listener(message,sender);
              if (result === undefined) return false;
              Promise.resolve(result).then(sendResponse,error=>sendError(sendResponse,error));
              return true;
            } catch (error) {
              sendError(sendResponse,error);
              return false;
            }
          });
        }
      }
    }
  };
})();
