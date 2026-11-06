/** Actual Node HTTP transport; shared by CLI and loopback acceptance tests. */
export function httpHandler(getRuntime,origin){return async(req,res)=>{
 try{
  if(req.headers.host!==new URL(origin).host){res.writeHead(403,{'Cache-Control':'no-store'});res.end('Host rejected');return;}
  let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>6*1024*1024){res.writeHead(413,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"Request too large"}');return;}chunks.push(c);}
  const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(v&&!k.startsWith('oai-authenticated-'))headers.set(k,Array.isArray(v)?v.join(','):v);
  const request=new Request(new URL(req.url,origin),{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await getRuntime().handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500,{'Cache-Control':'no-store'});res.end('Request failed');}
};}
