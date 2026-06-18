/**
 * One-off helper: mint a FRESH Google Sheets OAuth refresh token (read-only).
 *
 * Why: GOOGLE_SHEETS_REFRESH_TOKEN expired ("invalid_grant"), so the
 * case-acceptance / dropout GSheets importers can't read the sheets.
 *
 * We mint using the **physioward-ads Desktop client** (the GOOGLE_ADS_* creds)
 * because Desktop clients auto-allow localhost redirects — no Cloud Console
 * redirect-URI registration needed. After minting, set ALL THREE in .env:
 *   GOOGLE_SHEETS_CLIENT_ID     = <GOOGLE_ADS_CLIENT_ID>
 *   GOOGLE_SHEETS_CLIENT_SECRET = <GOOGLE_ADS_CLIENT_SECRET>
 *   GOOGLE_SHEETS_REFRESH_TOKEN = <printed below>
 * (the refresh token only works with the client that minted it).
 *
 * Run:  npm run token:google-sheets
 */
import dotenv from 'dotenv';
import http from 'http';
import { google } from 'googleapis';

dotenv.config();

const REDIRECT_URI = 'http://localhost:53682/oauth2callback';
const SCOPE        = 'https://www.googleapis.com/auth/spreadsheets.readonly';

// Reuse the Desktop client (physioward-ads) to skip redirect-URI registration.
const clientId     = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret) {
  console.error('\n✗ Missing GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET (Desktop client) in .env\n');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
const authUrl = oauth2.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: [SCOPE] });

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.url.startsWith('/oauth2callback')) { res.writeHead(404); res.end(); return; }
  const code = new URL(req.url, REDIRECT_URI).searchParams.get('code');
  if (!code) { res.writeHead(400); res.end('No authorization code.'); return; }
  try {
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Done ✓ — token printed in the terminal. You can close this tab.</h2>');
    if (tokens.refresh_token) {
      console.log('\n=================================================================');
      console.log('Set these THREE in .env (replace the old GOOGLE_SHEETS_* lines):\n');
      console.log('GOOGLE_SHEETS_CLIENT_ID=' + clientId);
      console.log('GOOGLE_SHEETS_CLIENT_SECRET=' + clientSecret);
      console.log('GOOGLE_SHEETS_REFRESH_TOKEN=' + tokens.refresh_token);
      console.log('=================================================================\n');
    } else {
      console.log('\n⚠ No refresh_token returned. Revoke at https://myaccount.google.com/permissions and re-run.\n');
    }
  } catch (e) { res.writeHead(500); res.end('Token exchange failed — see terminal.'); console.error('\n✗ Token exchange failed:\n', e); }
  finally { server.close(); }
});

server.listen(53682, () => {
  console.log('\n1. Open this URL and sign in with the Google account that owns the Sheets:\n');
  console.log('   ' + authUrl + '\n');
  console.log('2. Approve — you\'ll be redirected back and the token prints here.\n');
});
