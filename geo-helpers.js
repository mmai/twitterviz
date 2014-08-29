'use strict';
var Q = require('q');
var R = require('ramda');

var Carmen = require('carmen');
var MBTiles = require('mbtiles');
var geolib = require('geolib');

var Geo = function(tiles_directory){
  var geocoder = new Carmen({
    country: new MBTiles(tiles_directory + '/01-ne.country.mbtiles', callback_inspect),
    province: new MBTiles(tiles_directory + '/02-ne.province.mbtiles', callback_inspect),
    zipcode: new MBTiles(tiles_directory + '/03-tiger.zipcode.mbtiles', callback_inspect),
    place: new MBTiles(tiles_directory + '/04-mb.place.mbtiles', callback_inspect),
  });

  this.addGeoloc = function (objectWithAdress){
    var deferred = Q.defer();
    var searchString = R.get('location', objectWithAdress);

    geocoder.geocode(searchString, {}, function(err, res){
        if (err) {
          deferred.reject(err);
        } else {
          if (res.features && res.features.length){
            var data = res.features[0];
            if (data.relevance > 0.8){
              objectWithAdress["longitude"] = data.center[0];
              objectWithAdress["latitude"] = data.center[1];
            }
          }
          deferred.resolve(objectWithAdress);
        }
      });

    return deferred.promise;
  };
};
function callback_inspect (err, res){ if (err) console.log(err); }

Geo.prototype.middle = function(point1, point2, candidates){
  var geocenter = this.midpoint([point1, point2]);
  // var geocenter = geolib.getCenter([point1, point2]);
  // return geolib.findNearest(geocenter, candidates);
  return this.nearest(geocenter, candidates);
};

Geo.prototype.worldtour = function(origin, candidates){
  var farthest_place = this.farthest(origin, candidates);
  var middle1 = this.middle(origin, farthest_place, candidates);
  var middle2 = this.farthest(middle1, candidates);

  return [].concat(
    this.geopath(origin, middle1, candidates), [middle1], 
    this.geopath(middle1, farthest_place, candidates), [farthest_place], 
    this.geopath(farthest_place, middle2, candidates), [middle2], 
    this.geopath(middle2, origin, candidates)
  );
};

Geo.prototype.geopath = function(from, to, candidates){
  var path = [];
  var middle_candidate = this.middle(from, to, candidates);
  if (this.samePlace(from, middle_candidate) || this.samePlace(to, middle_candidate)){
    return [];
  } else {
    return path.concat(this.geopath(from, middle_candidate, candidates), [middle_candidate], this.geopath(middle_candidate, to, candidates));
  }
};

Geo.prototype.samePlace = function(point1, point2){
  var s1 = JSON.stringify(R.pickAll(['latitude', 'longitude'], point1));
  var s2 = JSON.stringify(R.pickAll(['latitude', 'longitude'], point2));
  return (s1 == s2);
};

Geo.prototype.farthest = function(origin, candidates){
  return R.last(this.sort_by_distance(origin, candidates));
  // return R.last(geolib.orderByDistance(origin, candidates));
};

Geo.prototype.nearest = function(origin, candidates){
  return R.first(this.sort_by_distance(origin, candidates));
  // return geolib.findNearest(origin, candidates);
};

Geo.prototype.sort_by_distance = function(origin, candidates){
  var farthest_from_origin = R.curry(this.farthest_from, 2);
  return R.sort(farthest_from_origin(origin), candidates);
};

Geo.prototype.farthest_from = function(origin, point1, point2){
  return geolib.getDistance(origin, point1) - geolib.getDistance(origin, point2);
};

Geo.prototype.midpoint = function(points){
  var X = 0.0;
  var Y = 0.0;
  var Z = 0.0;
  var lat, lon, hyp;

  points.forEach(function(point) {
    lat = point.latitude * Math.PI / 180;
    lon = point.longitude * Math.PI / 180;

    X += Math.cos(lat) * Math.cos(lon);
    Y += Math.cos(lat) * Math.sin(lon);
    Z += Math.sin(lat);
  });

  var nb_coords = points.length;
  X = X / nb_coords;
  Y = Y / nb_coords;
  Z = Z / nb_coords;

  lon = Math.atan2(Y, X);
  hyp = Math.sqrt(X * X + Y * Y);
  lat = Math.atan2(Z, hyp);

  return {
    latitude: lat * 180 / Math.PI,
    longitude: lon * 180 / Math.PI
  };
};

module.exports = Geo;
