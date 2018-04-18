import express from 'express';
import http from 'http'
import {remote} from 'electron';

const serverIp = '127.0.0.1';
const serverPort = 3415;
const serverAddr = `http://${serverIp}:${serverPort}/`;

const windowSettings = {
  center: true,
  width: 800,
  height: 600,
  minWidth: 800,
  minHeight: 600,
  maxWidth: 800,
  maxHeight: 600,
  maximizable: false,
  alwaysOnTop: true,
  webPreferences: {
    nodeIntegration: false,
  }
};

const cleanWindowStorage = (win, origin) => {
  win.webContents.session.clearStorageData(
    {
      'origin': origin,
      storages: [
        'appcache',
        'cookies',
        'filesystem',
        'indexdb',
        'localstorage',
        'shadercache',
        'websql',
        'serviceworkers'
      ]
    }, function () {
    });
};

const windowCss = `
body{
  color: #333; 
  padding: 40px 20px 0 20px; 
  text-align:center; 
  font-size: 16px; 
  font-family: "Helvetica Neue",Helvetica,Arial,sans-serif; 
  word-wrap: break-word; 
  line-height: 20px; 
}`;


export const openLoginDialog = (successCb, windowCloseCb) => {

  const scAppName = 'esteem-app';
  const scScope = 'vote,comment,delete_comment,comment_options,custom_json,claim_reward_balance';

  const genAuthUrl = () => {
    // return `https://steemconnect.com/authorize/@esteemapp?redirect_uri=${ encodeURIComponent(serverAddr)}`;
    return `https://v2.steemconnect.com/oauth2/authorize?client_id=${scAppName}&redirect_uri=${ encodeURIComponent(serverAddr)}&scope=${ encodeURIComponent(scScope)}`;
  };

  const expressApp = express();
  const server = http.createServer(expressApp);

  expressApp.get('/', (req, res) => {

      // Prevent users open web server in browser
      if (req.headers['user-agent'].indexOf('eSteemSurfer') === -1) {
        res.send(400);
        return;
      }

      let accessToken = req.query.access_token;
      let username = req.query.username;
      let expiresIn = req.query.expires_in;

      let error = req.query.error;
      let errorDescription = req.query.error_description;

      if (error) {
        res.send(`Error: ${error} - ${errorDescription}`);
      } else {
        if (accessToken && username && expiresIn) {
          res.send('<script>window.close(this);</script>');
          successCb(accessToken, username, expiresIn);
        } else {
          let authUrl = genAuthUrl();
          let js = `setTimeout(function(){ window.location.href = '${authUrl}'}, 1000)`;
          let resp = `
          <!doctype html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>eSteem Surfer</title>
            <style>${windowCss}</style>
            <script>${js}</script>
          </head>
          <body>You are redirecting to: <a href="${authUrl}">${authUrl}</a> </body>
          </html>`;
          res.send(resp);
        }
      }
    }
  );

  const win = new remote.BrowserWindow(windowSettings);

  // Clear session in order to steemconnect ask username and password for each request.
  cleanWindowStorage(win, 'https://v2.steemconnect.com');

  server.listen(serverPort, serverIp);
  server.on('listening', function () {
    win.loadURL(serverAddr);
  });

  win.on('closed', () => {
    server.close();
    server.unref();
    windowCloseCb();
  });
};


export const openTransferWindow = (to, amount, memo, successCb, windowCloseCb) => {

  const genTransferUrl = () => {
    const redirectUri = `${serverAddr}transfer-completed`;
    return `https://steemconnect.com/sign/transfer?to=${encodeURIComponent(to)}&amount=${encodeURIComponent(amount)}&memo=${encodeURIComponent(memo)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  };

  const expressApp = express();
  const server = http.createServer(expressApp);

  expressApp.all('*', function (req, res, next) {
    // Prevent users open web server in browser
    if (req.headers['user-agent'].indexOf('eSteemSurfer') === -1) {
      res.send(400);
    } else {
      next();
    }
  });

  expressApp.get('/', (req, res) => {
      const transferUrl = genTransferUrl();
      const js = `setTimeout(function(){ window.location.href = '${transferUrl}'}, 1000)`;
      const resp = `
          <!doctype html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>eSteem Surfer</title>
            <style>${windowCss}</style>
            <script>${js}</script>
          </head>
          <body>You are redirecting to: <a href="${transferUrl}">${transferUrl}</a> </body>
          </html>`;
      res.send(resp);
    }
  );

  expressApp.get('/transfer-completed', (req, res) => {
    res.send('<script>window.close(this);</script>');
    successCb();
  });

  const win = new remote.BrowserWindow(windowSettings);

  server.listen(serverPort, serverIp);
  server.on('listening', function () {
    win.loadURL(serverAddr);
  });

  win.on('closed', () => {
    server.close();
    server.unref();
    windowCloseCb();
  });
};
