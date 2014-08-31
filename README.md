Determine the best route to reach a destination, stopping at your Twitter followers' places.

Installation
============

Copy settings_example.js to settings.js and edit your Twitter credentials.
Then run these commands : 
```sh
npm install
./node_modules/carmen/scripts/install-dbs.sh
```

Usage
=====

```sh
node index.js -u <twitter_username> goto "Lisbon, Portugal"
node index.js -u <twitter_username> worldtour
```

