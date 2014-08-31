#!/usr/bin/env node

'use strict';

var cli = require('cli');
var Q = require('q');
var R = require('ramda');

var Twitter = require('./twitter-client');
var Geo = require('./geo-helpers');
var settings = require('./settings');

var geo = new Geo(__dirname + '/node_modules/carmen/tiles');

cli.parse({
    username:  ['u', 'The twitter user name', 'string'],
    limit:  ['l', 'Maximum number of followers to fetch', 'int']
  },
  ['farthest', 'worldtour']
);

var tw = new Twitter(settings.twitter_credentials);

tw.verifyCredentials().then(function(){
    var user_promise = tw.getInfos(cli.options.username).then(geo.addGeoloc);
    // .done();

    cli.output("Fetching @" + cli.options.username + " followers...\n");
    var nb_places, nb_localized;

    var followers_promise = tw.getFollowers(cli.options.username, {progress_callback:cli.progress, limit: cli.options.limit})
    // var followers_promise = tw.getFollowersTest()
    .then(function(data){
        return data;
      }, function(error){
        cli.error(error);
        cli.exit();
      }
    )
    .then(R.reject(R.where({location: ""})))
    .then(R.project(['id', 'id_str', 'name', 'screen_name', 'location']))
    .then(function(data){
        cli.ok("Found "+ data.length + " followers with locations\n");
        cli.output("Geocoding followers locations...\n");
        // cli.spinner("Geocoding followers locations..");
        return data;
      })
    .then(toPlaces)
    // .then(R.map(geo.addGeoloc))
    .then(function(places){
        nb_places = places.length;
        nb_localized = 0;
        return places;
      })
    .then(R.map(function(data){
          return geo.addGeoloc(data).then(function(place){
              cli.progress(++nb_localized / nb_places);
              return place;
            });
        }))
    .then(Q.all)
    .then(R.filter(R.prop('longitude')))
    .then(function(data){
        // cli.spinner("Geocoding followers locations.. done!\n", true);
        cli.ok("Found "+ data.length + " distinct locations\n");
        return data;
      })
    // .done();

    Q.all([user_promise, followers_promise]).then(function(datas){
        var user = datas[0];
        var places = datas[1];

        if (cli.command === 'farthest'){
          cli.spinner("Calculating itinerary...")
          var farthest_place = geo.farthest(user, places);
          var path = geo.geopath(user, farthest_place, places);
          path.push(farthest_place);
          cli.spinner("Calculating itinerary... done!\n", true);
          cli.output("\n--------------------------------------------------\n");
          cli.output("Going from " + user.location + " to " + formatPlaceUsers(farthest_place) + "\n");
          cli.output("--------------------------------------------------\n\n");
          path.forEach(function(place){
              cli.output(formatPlaceUsers(place) + "\n");
            });
        } else if (cli.command === 'worldtour'){
          cli.spinner("Calculating itinerary...")
          var worldtour = geo.worldtour(user, places);
          cli.spinner("Calculating itinerary... done!\n", true);
          cli.output("--------------------------------------------------\n");
          cli.output("Worldtour\n");
          cli.output("--------------------------------------------------\n\n");
          worldtour.forEach(function(place){
              cli.output(formatPlaceUsers(place) + "\n");
            });
        }
      })
    .done();
  });

function toPlaces(users){
  var placesObj = R.groupBy(function(user){return user.location}, users);
  var placesKeys = Object.keys(placesObj);
  var places = placesKeys.map(function(key){
      return {location: key, users: placesObj[key]};
    });
  return places;
}

function formatPlaceUsers(place){
  var users = "";
  if (place.users.length < 4){
    users = place.users.map(function(user){return user.name;}).join(", ");
  } else {
    users = place.users[0].name + ", " + place.users[1].name + " and " + (place.users.length - 2) + " others";
  }
  return place.location + " (" + users + ")";
}
