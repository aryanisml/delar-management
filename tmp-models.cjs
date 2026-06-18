// Throwaway: which Gemini models are reachable right now + do tool calls? Deleted after.
const fs=require('fs'),path=require('path');
function key(){for(const f of ['.env.local','.env']){const p=path.resolve(__dirname,f);if(!fs.existsSync(p))continue;for(const l of fs.readFileSync(p,'utf8').split(/\r?\n/)){const m=l.match(/^\s*GEMINI_API_KEY\s*=\s*(.*)\s*$/);if(m)return m[1].trim().replace(/^['"]|['"]$/g,'');}}return'';}
const tools=[{type:'function',function:{name:'search_customers',description:'Find a customer by mobile.',parameters:{type:'object',properties:{query:{type:'string'}},required:['query']}}}];
const messages=[{role:'system',content:'Use tools.'},{role:'user',content:'find the customer with mobile 9876501234'}];
async function test(model){
  let last;
  for(let i=0;i<2;i++){
    const res=await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key()},body:JSON.stringify({model,temperature:0.1,messages,tools,tool_choice:'auto'})});
    if(res.status===200){const j=await res.json();const tc=j.choices?.[0]?.message?.tool_calls;return `${model.padEnd(26)} 200  ${tc?('tool_call OK: '+tc[0].function.name):'(text, no tool)'}`;}
    last=res.status; if(res.status===503){await new Promise(s=>setTimeout(s,700));continue;}
    const b=await res.text(); return `${model.padEnd(26)} ${res.status}  ${b.slice(0,90).replace(/\s+/g,' ')}`;
  }
  return `${model.padEnd(26)} ${last}  (overloaded)`;
}
(async()=>{
  for(const m of ['gemini-2.5-flash','gemini-2.0-flash','gemini-2.5-flash-lite','gemini-flash-latest']){
    console.log(await test(m));
  }
})();
