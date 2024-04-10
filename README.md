# CSCI3280_Project

Directories are self-explanatory

# Setting up

You'll need [Node.js](https://nodejs.org/en/download). Tested on Node.js v20.11.1. MAY NOT WORK ON OLDER VERSIONS.

Tested browsers: Firefox, Google Chrome, Edge. Works on all

## Preparing HTTPS

Since we're using the crypto module, we need https. Therefore:

While in the root directory:

```console
openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 -keyout private.key -out voice-record-chat.crt
```
Command reference: [https://www.youtube.com/watch?v=s2YxcPR_yhw](https://www.youtube.com/watch?v=s2YxcPR_yhw)

And fill out the requirements. Their contents do not matter, they are just so that we can run HTTPS.

## Setting up environment variables

In each directory, clone .env and name the clone .env.local. In the client directory, paste your private ip into `VITE_HOST`. In the server directory, paste it into `HOST`. MAKE SURE you do not put quotes. It should look like:

```
HOST=your-private-ip
```
and
```
VITE_HOST=your-private-ip
```

## Building the app

While in the client directory:

```console
npm install
npm run build
```

While in the server directory:

```console
npm install
```

## Running the app

Preface: your browser will not trust the site (after all, it is using a self-signed certificate), since it is the certificate you made you can trust it.

While in the client directory:

```console
npm run preview -- --host
```

While in the server directory:

```console
npm run server
```

This will run two servers: One server will host and serve the frontend (`npm run build -- --host`) and the other will act as the backend (`npm run server`). The console on the terminal that runs the frontend will tell you the URL to access the website (it will look something like `https://your-private-ip:4173`).

FOR FIREFOX USERS: You will also need to access `https://your-private-ip:8000` and tell the browser to trust the certificate there as well, because firefox doesn't apply that trust to all ports of the host name.

## Speech2text capabilities (phase 1)

Clone .env, name the clone .env.local (already done if you setup the server properly), then create a [wit.ai](https://wit.ai/) API key and paste it in .env.local (`VITE_WIT_API`).
