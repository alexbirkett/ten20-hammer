var optimist = require('optimist');
var requestApi = require('request');
var request = requestApi.defaults({followRedirect: false, jar: requestApi.jar()});
var async = requre('async');

var argv = optimist.usage('Usage: $0  --serial [string] --url [string] --frequency [num]').
    options('n', {
        alias : 'number',
        describe: 'number of trackers'
    }).
    options('u', {
        alias : 'url',
        describe: 'url'
    }).
    options('f', {
        alias : 'frequency',
        describe: 'update frequency in seconds'
    }).
   default('f',1).
   default('n', 1000).
   default('u', 'http://localhost:3000')
   .argv;

var postAndExpect200 = function(url, requestBody, errorMessageToPassbackOnUnexpectedResponse, callback) {
    request.post({url: url, json: requestBody}, function(error, response, body) {

        if (err) {
            callback(err);
        } else {
            if (response.statusCode === 200) {
                callback(null);
            } else {
                callback(errorMessageToPassbackOnUnexpectedResponse + ' - status code ' + response.statusCode);
            }
        }
    });
}
var credential1 = {
    email: 'test@ten20.com',
    password: 'passwordone'
};

var signup = function(credential, callback) {
    postAndExpect200(url + '/signup', credential, callback);
};

var signin = function(credential, callback) {
    postAndExpect200(url + '/signin', credential, callback);
};


async.series([
  function(callback) {
      signup(callback);
  },
  function(callback) {
      signin(callback);
  }
], function(err) {

    });



/*var postNextLocation = function() {

    var message = {

    };

    console.log('posting message');
    //console.log(message);

    var timeBefore = new Date().getTime();

    request.post({url: argv.url + '/' + argv.serial, json: message}, function(err, response, body) {
        if (err) {
            console.log('error ' + err);
        }
        if (response) {
            console.log('status ' + response.statusCode + ' request took ' + (new Date().getTime() - timeBefore));
        }
        setTimeout(postNextLocation, argv.frequency * 1000);
    });


}

postNextLocation();*/



