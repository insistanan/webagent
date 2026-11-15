// Complete MCP JSON only. Narrow, string-aware repairs; never evaluate code or
// guess a truncated object. No content-length cutoff for file creation payloads.
(function(root) {
  'use strict';
  const toolKey=/"(?:tool|tool_name|function|name|action)"\s*:/;
  function repairJson(raw) {
    const chunks=[];let inString=false,controls=0,slashes=0,commas=0;
    for(let i=0;i<raw.length;i++) {
      const c=raw[i];
      if(inString) {
        if(c==='\\') {
          const next=raw[i+1];
          if(next && /["\\/bfnrtu]/.test(next)) {
            chunks.push(c,next);i++;continue;
          }
          // Retain the literal backslash, including one before a real newline.
          // Invalid unicode escapes remain invalid, never guessed/corrected.
          chunks.push('\\\\');slashes++;continue;
        }
        if(c==='"')inString=false;
        else if(c.charCodeAt(0)<32) {
          chunks.push('\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
          controls++;continue;
        }
      } else {
        if(c==='"')inString=true;
        if(c===',') {
          let j=i+1;while(j<raw.length && /\s/.test(raw[j]))j++;
          if(raw[j]===']'||raw[j]==='}') {commas++;continue;}
        }
      }
      chunks.push(c);
    }
    return {json:chunks.join(''),controls,slashes,commas};
  }
  function* objects(text) {
    let start=-1,depth=0,inString=false,escape=false;
    for(let i=0;i<text.length;i++) {
      const c=text[i];
      if(start===-1) {if(c!=='{')continue;start=i;depth=1;continue;}
      if(inString) {
        if(escape){escape=false;continue;}
        if(c==='\\'){escape=true;continue;}
        if(c==='"')inString=false;
        continue;
      }
      if(c==='"'){inString=true;continue;}
      if(c==='{')depth++;
      if(c==='}' && --depth===0) {
        yield {text:text.slice(start,i+1),complete:true};start=-1;
      }
    }
    if(start!==-1)yield {text:text.slice(start),complete:false};
  }
  function normalize(obj,isKnownTool) {
    if(!obj || typeof obj!=='object' || Array.isArray(obj))return null;
    const tool=obj.tool||obj.tool_name||obj.function||obj.name||obj.action;
    if(typeof tool!=='string' || !/^[a-zA-Z0-9_-]+$/.test(tool.trim()))return null;
    if(!obj.tool && !obj.tool_name && !obj.function && !isKnownTool?.(tool))return null;
    let args;
    if(obj.arguments && typeof obj.arguments==='object')args=obj.arguments;
    else if(obj.args && typeof obj.args==='object')args=obj.args;
    else {
      args={...obj};
      for(const key of ['tool','tool_name','function','name','action'])delete args[key];
    }
    return {tool:tool.trim(),args};
  }
  function inspect(raw,options={}) {
    if(typeof raw!=='string'||!toolKey.test(raw))return {status:'ignored',call:null};
    for(const candidate of objects(raw)) {
      if(!toolKey.test(candidate.text))continue;
      if(!candidate.complete)return {status:'incomplete',call:null,reason:'truncated-json'};
      let obj,repair={controls:0,slashes:0,commas:0};
      try {obj=JSON.parse(candidate.text);}
      catch {
        repair=repairJson(candidate.text);
        try {obj=JSON.parse(repair.json);}
        catch {return {status:'invalid',call:null,reason:'invalid-json'};}
      }
      const call=normalize(obj,options.isKnownTool);
      if(call)return {status:'parsed',call,repairs:{controls:repair.controls,slashes:repair.slashes,commas:repair.commas}};
      // Do not treat a nested "tool" inside HTML / application data as an invocation.
    }
    return {status:'ignored',call:null};
  }
  function firstObject(raw) {
    if(typeof raw!=='string')return null;
    for(const candidate of objects(raw))if(candidate.complete && toolKey.test(candidate.text))return candidate.text;
    return null;
  }
  const api={inspect,repairJson,firstObject};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.WebAgentToolJson=api;
})(globalThis);
