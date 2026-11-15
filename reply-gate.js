// Skip hydrated history after reload/navigation; allow new submissions and new replies.
(function(root){
  'use strict';
  function create(options={}){
    let url=null,baselinePending=true,lastText='',submitted=false,continued=false;
    function setRoute(route){
      if(route===url)return;
      if(submitted && options.canContinueRoute?.(url,route)){url=route;continued=true;return;}
      url=route;baselinePending=true;lastText='';submitted=false;continued=false;
    }
    return {
      route:setRoute,
      submit(route,baselineText){setRoute(route);submitted=true;continued=false;if(typeof baselineText==='string'){lastText=baselineText;baselinePending=false;}},
      cancel(route,baselineText){setRoute(route);submitted=false;continued=false;if(typeof baselineText==='string'){lastText=baselineText;baselinePending=false;}},
      accept(route,text){
        setRoute(route);
        if(!text)return false;
        if(continued){
          const matches=options.matchesContinuedSubmission?.();
          if(matches===null)return false; // Wait for the new user bubble to hydrate.
          if(matches!==true){submitted=false;continued=false;lastText=text;baselinePending=false;return false;}
        }
        if(baselinePending){baselinePending=false;lastText=text;if(!submitted)return false;}
        else if(!submitted||text===lastText){lastText=text;return false;}
        lastText=text;submitted=false;continued=false;return true;
      }
    };
  }
  const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.WebAgentReplyGate=api;
})(globalThis);
