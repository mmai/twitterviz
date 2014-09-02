Installation
------------

* Follow these instructions to create a twitter app and get access tokens : https://dev.twitter.com/docs/auth/tokens-devtwittercom
* Copy settings_example.js to settings.js and edit your Twitter credentials.
* Install dependencies and download Geolocation data (300 MB) with these commands:

```sh
npm install
./node_modules/carmen/scripts/install-dbs.sh
```

Usage
-----

```sh
node bin/twitterviz.js -u <twitter_username> goto "Lisbon, Portugal"
node bin/twitterviz.js -u <twitter_username> worldtour
```

