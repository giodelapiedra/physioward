/**
 * One-off helper: mint a FRESH Google Ads OAuth refresh token.
 *
 * Why you're here: the GOOGLE_ADS_REFRESH_TOKEN in .env stopped working
 * ("invalid_grant" / token expired). Google revokes refresh tokens after
 * 7 days while the OAuth consent screen is still in "Testing" publishing
 * status — see the note at the bottom for the PERMANENT fix.
 *
 * Run:
 *   npm run token:google-ads
 *
 * One-time prerequisite (Google Cloud Console → APIs & Services →
 * Credentials → your OAuth 2.0 Client → Authorized redirect URIs), add:
 *   http://localhost:53682/oauth2callback
 *
 * Then paste the printed value into .env as GOOGLE_ADS_REFRESH_TOKEN and
 * restart the backend.
 */
import dotenv from 'dotenv';
import http from 'http';
import { google } from 'googleapis';

dotenv.config();

const REDIRECT_URI = 'http://localhost:53682/oauth2callback';
const SCOPE        = 'https://www.googleapis.com/auth/adwords';

const clientId     = process.env.GOOGLE_ADS_CLIENT_ID;
const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('\n✗ Missing GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET in .env\n');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt:      'consent', // force Google to return a NEW refresh_token every run
  scope:       [SCOPE],
});

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.url.startsWith('/oauth2callback')) {
    res.writeHead(404); res.end(); return;
  }
  const code = new URL(req.url, REDIRECT_URI).searchParams.get('code');
  if (!code) {
    res.writeHead(400); res.end('No authorization code in callback.'); return;
  }
  try {
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Done ✓ — your refresh token is printed in the terminal. You can close this tab.</h2>');

    if (tokens.refresh_token) {
      console.log('\n=================================================================');
      console.log('Paste this line into backend/.env (replace the old one), then restart:\n');
      console.log('GOOGLE_ADS_REFRESH_TOKEN=' + tokens.refresh_token);
      console.log('=================================================================\n');
    } else {
      console.log('\n⚠ Google did not return a refresh_token (it only does so on first');
      console.log('  consent). Revoke this app at https://myaccount.google.com/permissions');
      console.log('  then run this script again.\n');
    }
  } catch (e) {
    res.writeHead(500); res.end('Token exchange failed — see terminal.');
    console.error('\n✗ Token exchange failed:\n', e);
  } finally {
    server.close();
  }
});

server.listen(53682, () => {
  console.log('\n1. Open this URL in your browser and sign in with the Google account that owns the Google Ads:\n');
  console.log('   ' + authUrl + '\n');
  console.log('2. Approve the permissions. You\'ll be redirected back and the token prints here.\n');
});
