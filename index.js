var optimist = require('optimist');
var requestApi = require('request');
var request = requestApi.defaults({followRedirect: false, jar: requestApi.jar()});
var async = require('async');
var utils = require('./utils');

var argv = optimist.usage('Usage: $0  --serial [string] --url [string] --frequency [num]').
    options('n', {
        alias: 'number-of-trackers-per-user',
        describe: 'number of trackers per user'
    }).
    options('o', {
        alias: 'number-of-users',
        describe: 'number of users'
    }).
    options('u', {
        alias: 'url',
        describe: 'url'
    }).
    options('f', {
        alias: 'frequency',
        describe: 'update frequency in seconds'
    }).
    options('t', {
        alias: 'delete-trips',
        describe: 'delete trips'
    }).
    options('r', {
        alias: 'delete-trackers',
        describe: 'delete trackers'
    }).
    options('s', {
        alias: 'delete-users',
        describe: 'delete users'
    }).
    options('c', {
        alias: 'create-users',
        describe: 'create users'
    }).
    options('d', {
        alias: 'create-trackers',
        describe: 'create trackers'
    }).
    default('o', 100).
    default('f', 60).
    default('n', 10).
    default('u', 'http://localhost:3001')
    .argv;

var requestAndExpect200 = function (request, method, url, requestBody, errorMessageToPassbackOnUnexpectedResponse, callback) {
    request[method]({url: url, json: requestBody}, function (error, response, body) {
        if (error) {
            callback(error);
        } else {
            if (response.statusCode === 200) {
                callback(null);
            } else {
                callback(errorMessageToPassbackOnUnexpectedResponse + ' - status code ' + response.statusCode);
            }
        }
    });
};

var signup = function (request, credential, callback) {
    requestAndExpect200(request, 'post', argv.url + '/signup', credential, 'invalid signup response', callback);
};

var signin = function (request, credential, callback) {
    requestAndExpect200(request, 'post', argv.url + '/signin', credential, 'invalid signing response', callback);
};

var postTracker = function(request, tracker, callback) {
    requestAndExpect200(request, 'post', argv.url + '/trackers', tracker, 'invalid response to put tracker', callback);
};

var deleteCollection = function (request, collectionName, callback) {
    console.log('deleteing ' + collectionName);
    request.del(argv.url + '/collection-admin/' + collectionName, true, function(err) {
        callback();
    });
};

var getCredential = function(i) {
    var credential = {
        email: 'test@ten20' + i + '.com',
        password: 'passwordone'
        };
    return credential;
}

var requests = [];

var createRequests = function(number) {
    for (var i = 0; i < number; i++) {
        requests[i] = requestApi.defaults({followRedirect: false, jar: requestApi.jar()});
    }
};

var createUsers = function(number, callback) {
    console.log('creating ' + number + ' users');
    var i = 0;
    utils.doWhilstParallel(function(callback) {
        var credential = getCredential(i);
        signup(requests[i], credential, callback);
    },function() {
        return (++i < number);
    }, callback);
};

var signInAllUsers = function(number, callback) {
    console.log('signing in ' + number + ' users');
    var i = 0;
    utils.doWhilstParallel(function(callback) {
        var credential = getCredential(i);
        signin(requests[i], credential, callback);
    },function() {
        return (++i < number);
    }, callback);
};

var calculateTrackerSerial = function(userIndex, trackerIndex) {
    return 'user' + userIndex + 'tracker' + trackerIndex;
};

var createTracker = function(userIndex, trackerIndex) {
   var tracker = {
       serial: calculateTrackerSerial(userIndex, trackerIndex)
   };
   return tracker;
};

var createTrackers = function(numberOfUsers, numberOfTrackersPerUser, callback) {

    console.log('creating ' + numberOfTrackersPerUser + ' trackers per user for ' + numberOfUsers + ' users');

    var userIndex = 0;

    utils.doWhilstParallel(function(callback) {
        var trackerIndex = 0;
        utils.doWhilstParallel(function(callback) {
            var tracker = createTracker(userIndex, trackerIndex);
            postTracker(requests[userIndex], tracker, callback);
        },function() {
            return (++trackerIndex < numberOfTrackersPerUser);
        }, callback);

    },function() {
        return (++userIndex < numberOfUsers);
    }, callback);
};

var deleteCollections = function(callback) {
    async.series([
        function (callback) {
            deleteCollection(request, 'user', callback);
        },
        function (callback) {
            deleteCollection(request, 'trackers', callback);
        },
        function (callback) {
            deleteCollection(request, 'trips', callback);
        }
    ], function (err) {
        callback(err);
    });
};

var postNextMessage = function(request, serial, count) {

    var message = {
        timestamp: new Date(),
        serial: serial,
        count: count++
    };

    console.log('posting message');
    //console.log(message);

    var timeBefore = new Date().getTime();

    request.post({url: argv.url + '/message/' + serial, json: message}, function(err, response, body) {
        if (err) {
            console.log('error ' + err);
        }
        if (response) {
            console.log('status ' + response.statusCode + ' request took ' + (new Date().getTime() - timeBefore));
        }
        setTimeout(function() {
            postNextMessage(request, serial, count);
        }, argv.frequency * 1000);
    });
};


var startPostingMessages = function(numberOfTrackersPerUser, callback) {

    var timeoutInterval = (argv.frequency * 1000) / (numberOfTrackersPerUser * requests.length);
    var userIndex = 0;
    async.doWhilst(function(callback) {
        var trackerIndex = 0;
        async.doWhilst(function(callback) {
            console.log('calling post message');
            postNextMessage(requests[userIndex], calculateTrackerSerial(userIndex, trackerIndex), 0);
            setTimeout(callback, timeoutInterval);
        },function() {
            return (++trackerIndex < numberOfTrackersPerUser);
        }, callback);

    },function() {
        return (++userIndex < requests.length);
    }, callback);
};

var createTaskArray = function() {
    var tasks = [];


    if (argv['delete-trackers']) {
        tasks.push(function(callback) {
            deleteCollection(request, 'trackers', callback);
        });
    }

    if (argv['delete-trips']) {
        tasks.push(function(callback) {
            deleteCollection(request, 'trips', callback);
        });
    }

    if (argv['delete-users']) {
        tasks.push(function(callback) {
            deleteCollection(request, 'user', callback);
        });
    }

    if (argv['create-users']) {
        tasks.push(function(callback) {
            createUsers(argv['number-of-users'], callback);
        });
    }

    tasks.push(function(callback) {
        signInAllUsers(argv['number-of-users'], callback);
    });

    if (argv['create-trackers']) {
        tasks.push(function(callback) {
            createTrackers(argv['number-of-users'], argv['number-of-trackers-per-user'], callback);
        });
    }

    tasks.push(function(callback) {
        startPostingMessages(argv['number-of-trackers-per-user'], callback);
    });




    return tasks;
};

createRequests(argv['number-of-users']);

async.series(createTaskArray(), function (err) {
    console.log('error ' + err);
});




