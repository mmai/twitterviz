#!/usr/bin/env node

'use strict';

var cli = require('cli');
var Q = require('q');
var R = require('ramda');

var Twitter = require(__dirname + '/../twitter-client');
var Geo = require(__dirname + '/../geo-helpers');
var settings = require(__dirname + '/../settings');

var geo = new Geo(__dirname + '/../node_modules/carmen/tiles');

cli.parse({
    username:  ['u', 'Twitter user name', 'string'],
    from:  ['f', 'Start point location', 'string'],
    limit:  ['l', 'Maximum number of followers to fetch', 'int']
  },
  ['farthest', 'worldtour', 'goto']
);

//Check the destination
if (cli.command === "goto"){
  var found_destination = checkLocation(cli.args[0]).fail(showErrorAndExit);
}

//Check the origin
var origin = false;
if (cli.options.from){
  checkLocation(cli.options.from).then(function(localized_origin){
      origin = localized_origin;
    }).fail(showErrorAndExit);
}

//Everything ok. We can fetch twitter followers infos. 
var tw = new Twitter(settings.twitter_credentials);

tw.verifyCredentials().then(function(){
    var user_promise = tw.getInfos(cli.options.username).fail(showErrorAndExit)
    .then(geo.addGeoloc);
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
        var places = datas[1];
        origin = origin || datas[0];
        if (!origin.latitude){
          cli.error("Could not localize @" + cli.options.username + " and no origin location set. Try with the --from option.");
          cli.exit();
        }

        if (cli.command === 'goto'){
          found_destination.then(function(destination){
              cli.spinner("Calculating itinerary...")
              var path = geo.gotopath(origin, destination, places);
              cli.spinner("Calculating itinerary... done!\n", true);
              cli.output("\n--------------------------------------------------\n");
              cli.output("Going from " + origin.location + " to " + destination_name + "\n");
              cli.output("--------------------------------------------------\n\n");
              path.forEach(function(place){
                  cli.output(formatPlaceUsers(place) + "\n");
                });
              // cli.output(destination_name + "\n");
            });
        } else if (cli.command === 'farthest'){
          cli.spinner("Calculating itinerary...")
          var farthest_place = geo.farthest(origin, places);
          var path = geo.geopath(origin, farthest_place, places);
          path.push(farthest_place);
          cli.spinner("Calculating itinerary... done!\n", true);
          cli.output("\n--------------------------------------------------\n");
          cli.output("Going from " + origin.location + " to " + formatPlaceUsers(farthest_place) + "\n");
          cli.output("--------------------------------------------------\n\n");
          path.forEach(function(place){
              cli.output(formatPlaceUsers(place) + "\n");
            });
        } else if (cli.command === 'worldtour'){
          cli.spinner("Calculating itinerary...")
          var worldtour = geo.worldtour(origin, places);
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
  }).done();

function checkLocation(placeName){
  var deferred = Q.defer();
  geo.addGeoloc({location: placeName}).then(function(data, error){
      if (error || !data.latitude){
        deferred.reject("Could not localize '"+ placeName + "'");
      } 
      deferred.resolve(data);
    });
  return deferred.promise;
}

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
    users = place.users.map(function(user){return "@" + user.screen_name;}).join(", ");
  } else {
    users = "@" + place.users[0].screen_name + ", @" + place.users[1].screen_name + " and " + (place.users.length - 2) + " others";
  }
  return place.computed_location + " (" + users + ")";
}

function showErrorAndExit(err){
  cli.error(err);
  cli.exit();
}
