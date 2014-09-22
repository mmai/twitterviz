var cachedData = null;
var isLogged = false;
hello.on('auth.login', function(r){
    isLogged = true;

    hello.api(r.network+':/me', function(p){
        document.getElementById('loginStatus').innerHTML = "<img src='"+ p.thumbnail + "' width=24/> Connected to "+ r.network+" as " + p.name;
      });
  });

hello.init({
    'twitter' : 'kY8RNvNTeEbaier9Q48BJQIOH'
  }, {
    redirect_uri:'redirect.html',
    // oauth_proxy: 'https://auth-server.herokuapp.com/proxy'
    oauth_proxy: 'http://127.0.0.1:3000/oauthproxy'
  }
);


var gmapProxy = new ProxAPI({
    retryDelay: 60*5,
    translate: function(params, handleResults){
      var status = {
        quota: false
      };

      $.getJSON('http://maps.googleapis.com/maps/api/geocode/json?address=' + params.address + '&sensor=false', null, function (data) {
          var point = data.results[0].geometry.location
          handleResults(null, point, status);
        });
    }
  });

function getFollowers(){
  var twitterProxy = new ProxAPI({
      retryDelay: 60*5,
      translate: function(params, handleResults){
        var status = {
          quota: false
        };

        /*
        hello( "twitter" ).api("followers/list.json", "get", {screen_name: params.twitter_account}).then(function(json){
            var r = JSON.parse(json);
            handleResults(null, r, status);
          }, function(e){
            // if (true) status = {quota: true};
            handleResults(e, null, status);
          });
        */


        hello( "twitter" ).api("followers/list.json", "get", {screen_name: params.twitter_account}).on( 'success', function( json, next ){
            if( next ){
              console.log("next");
              // next();
            } else{
              console.log(" That's it!" );
            }
            var r = JSON.parse(json);
            handleResults(null, r, status);
          }).on('error', function(e){
              console.log("Whoops!");
              if (true) status = {quota: true};
              handleResults(e, null, status);
            });
      }
    });

  var params = {
    twitter_account: document.getElementById('twitterinput').value,
    cursor: -1
  };

  var options = {
    strategy: "retry",
    onEvent: function(eventName, data){
      if (eventName === "retrying"){
        console.log(data);
      }
    }
  };

  var callSettings = {
    endCondition: function(err, data){
      return (data.next_cursor_str == '0');
    },
    newParams: function(error, data, params){
      return {
        twitter_account: params.twitter_account,
        cursor: data.next_cursor_str
      };
    },
    aggregate: function(acc, res){
      return acc.concat(res.data);
    }
  };

  if (!isLogged){
    hello.login('twitter');
    document.getElementById('loginStatus').innerHTML = "Trying to connect to Twitter...";
    //Try to log on twitter wait 30 seconds and retry
    setTimeout(getFollowers, 30000);
  } else {
    twitterProxy.callUntil(callSettings, params, options, function(err, data){
        cachedData = data;
        display("Total followers: " + data.length);
        placeOnMap(data);
      });
  }
}

function placeOnMap(data){
  data = data || cachedData;
  var map;
  var elevator;
  var myOptions = {
    zoom: 1,
    center: new google.maps.LatLng(0, 0),
    mapTypeId: 'terrain'
  };
  map = new google.maps.Map($('#map_canvas')[0], myOptions);

  var proxyOptions = {
    strategy: "retry",
    onEvent: function(eventName, data){
      if (eventName === "retrying"){
        display(data);
      }
    }
  };

  var address = null;
  for (var x = 0; x < data.length; x++) {
    if (data[x].location){
      address = encodeURIComponent(data[x].location);
      gmapProxy.call({address: address}, proxyOptions, function(err, point){
          var latlng = new google.maps.LatLng(point.lat, point.lng);
          new google.maps.Marker({
              position: latlng,
              map: map
            });
        });
    }
  }
}

var whiteBoard = document.getElementById("whiteBoard");
function display(txt){
  whiteBoard.innerHTML = whiteBoard.innerHTML + "\n" + JSON.stringify(txt);
}
