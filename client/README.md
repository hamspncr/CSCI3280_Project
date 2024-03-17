# CSCI 3280 Project - Client

You'll need [Node.js](https://nodejs.org/en/download)

## Building

To run developer mode: 

```console
npm install
npm run dev
```

To build and run final version:

```console
npm run build
npm run preview
```

## Speech2text capabilities

Clone .env, name the clone .env.local, then create a [wit.ai](https://wit.ai/) API key and paste it in .env.local if you wanna try out the speech2text module, there's no UI for it as of yet and the actual function is quite barebones (doesn't handle errors)
