import {OAuth2Client} from 'google-auth-library';
export function googleVerifier(clientId,client=new OAuth2Client(clientId)){
 if(!clientId||!clientId.endsWith('.apps.googleusercontent.com'))throw Error('Configure SAR_GOOGLE_CLIENT_ID');
 return async credential=>{
  const ticket=await client.verifyIdToken({idToken:credential,audience:clientId});
  const p=ticket.getPayload();
  if(!p?.sub||!['accounts.google.com','https://accounts.google.com'].includes(p.iss)||!p.exp||p.exp*1000<=Date.now())throw Error('Invalid Google identity');
  return {subject:p.sub,nonce:p.nonce};
 };
}
