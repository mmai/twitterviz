'use strict';

var Q = require('q');
var twit = require('twit');
var fs = require('fs');

var Twitter = function(twitter_credentials){
  this.credentials = twitter_credentials;
}

Twitter.prototype = {
  verifyCredentials: function(){
    var deferred = Q.defer();
    this.twitter = new twit(this.credentials);
    deferred.resolve(true);
    return deferred.promise;
  },
  getInfos: function(twitter_account){
    var deferred = Q.defer();
    this.twitter.get('users/lookup', {screen_name: twitter_account}, function (err, data, response){
        if (err) {
          deferred.reject(err);
        } else {
          if (data.length == 0){
            deferred.reject(new Error("User not found"));
          } else {
            deferred.resolve(data[0]);
          }
        }
      });
    return deferred.promise;
  },
  getFollowers: function(twitter_account, options){
    var progress_callback = options.progress_callback;
    var limit = options.limit;
    var self = this;
    var deferred = Q.defer();

    // Check if twitter quotas allow us to make the request
    return this.getInfos(twitter_account).then(function(user){
        var followers_count = user.followers_count;
        if (options.limit){
          followers_count = Math.min(options.limit, followers_count);
        }

        var nb_requests_needed = Math.ceil( followers_count / 200);
        self.twitter.get("application/rate_limit_status", {resources: 'followers'}, function (err, quotas) {
            var quota = quotas.resources.followers['/followers/list'].remaining;
            if (quota < nb_requests_needed){
              deferred.reject("Insuficient Twitter quota ("+quota+" for "+nb_requests_needed+" needed)");
            } else {
              // console.log("Twitter quota OK ("+quota+" for "+nb_requests_needed+" needed)");
              progress_callback(0);
              var progress_options = {callback:progress_callback, max: nb_requests_needed, count: 0};
              self._getFollowers(twitter_account, -1, progress_options).then(deferred.resolve);
            }
          });
        return deferred.promise;
      });
  },
  _getFollowers: function(twitter_account, cursor, progress){
    var self = this;
    cursor = cursor || -1;
    var deferred = Q.defer();
    this.twitter.get("followers/list", {screen_name: twitter_account, count: 200, cursor: cursor}, function (err, data) {
        if (err) {
          deferred.reject(err);
        } else {
          if (progress){//Update progress bar if provided
            progress.count = progress.count + 1;
            progress.callback(progress.count / progress.max);
          }
          if (data.next_cursor_str == '0' || progress.count === progress.max){
            //All result pages have been fetched
            deferred.resolve(data.users);
          } else {
            //There are more result pages to fetch
            self._getFollowers(twitter_account, data.next_cursor_str, progress)
            .then(function(users){
                deferred.resolve(data.users.concat(users));
              });
          }
        }
      }
    );
    return deferred.promise;
  },
  getFollowersTest: function(){
    var deferred = Q.defer();
    fs.readFile('getFollowersResults.json', function (err, data) {
        if (err) deferred.reject(err);
        deferred.resolve(JSON.parse(data));
      });
    return deferred.promise;
  }
}

module.exports = Twitter;
