var optimist = require('optimist');
var requestApi = require('request');
var request = requestApi.defaults({followRedirect: false, jar: requestApi.jar()});
var async = require('async');
var utils = require('./utils');
var ResponseTimes = new require('./response-times');
var responseTimes = new ResponseTimes(100);
var FunctionCallCounter = require('./function-call-counter');
var http = require('http');
pool = new http.Agent(); //Your pool/agent
pool.maxSockets = 500;

var argv = optimist.usage('Usage: $0  --number-of-trackers-per-user [number] --number-of-users [number] --url [string] --timeout [num] --delete-trips --delete-users --create-users').
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
        alias: 'timeout',
        describe: 'inital update timeout in seconds'
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
        alias: 'target-response-time',
        describe: 'the hammer will keep adding load until responses take target-response-time ms'
    }).
    options('e', {
        alias: 'create-trackers',
        describe: 'create trackers'
    }).
    options('g',{
        alias: 'number-of-parallel-requests',
        describe: 'number of requests to execute in parallel'
    }).
    default('o', 1000).
    default('f', 100).
    default('n', 10).
    default('d', 100).
    default('g', 2).
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
        var request = requestApi.defaults({followRedirect: false, jar: requestApi.jar(), pool: pool});
        request.messageCount = 0;
        requests[i] = request;
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
    }, function(err) {
        console.log('signin complete');
        callback(err);
    });
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

var timeout = argv['timeout'];


var calculateTimeout = function() {

    var averageResponseTime = responseTimes.calculateAverage();
    if (averageResponseTime > argv['target-response-time']) {
        timeout++
    } else {
        if (timeout > 0) {
            timeout--;
        }
    }
    return timeout;
};

var postNextMessageCounter = new FunctionCallCounter();


var postNextMessage = function(requestIndex, trackerIndex, callback) {

    postNextMessageCounter.called();

    var serial = calculateTrackerSerial(requestIndex, trackerIndex);

    var request = requests[requestIndex];

    var message = {
        timestamp: new Date(),
        serial: serial,
        count: request.messageCount++
    };

    var timeBefore = new Date().getTime();

    var url = argv.url + '/message/' + serial;
    requestAndExpect200(request, 'post', url, message, 'invalid post message response', function(err) {
        if (err) {
            console.log('error ' + err);
        }
        responseTimes.addTime(new Date().getTime() - timeBefore);
        callback(err);
    });
};

var startPostingMessages = function(callback) {
    var trackerIndex = 0;
    var requestIndex = 0;

    var getRequestIndex = function() {
        if (++requestIndex === requests.length) {
            requestIndex = 0;
            trackerIndex++;
        }
        return requestIndex;
    };

    var getTrackerIndex = function() {
        if (trackerIndex ===  argv['number-of-trackers-per-user']) {
            trackerIndex = 0;
        }
        return trackerIndex;
    };

    async.forever(function(callback) {
        async.series([
        function(callback){

            var parallelRequestIndex = 0;
            utils.doWhilstParallel(function(callback) {
                postNextMessage(getRequestIndex(), getTrackerIndex(), callback);
            },function() {
                return (++parallelRequestIndex < argv['number-of-parallel-requests']);
            }, callback);
        },function(callback) {
            setTimeout(callback, calculateTimeout());
        }], function(err) {
            callback(err);
        });
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
        startPostingMessages(callback);
    });

    return tasks;
};

createRequests(argv['number-of-users']);

var printDebug = true;
var printAverageResponseTime = function() {

    console.log('average response time ' + responseTimes.calculateAverage() + ' timeout ' + timeout + ' post next message called ' + postNextMessageCounter.count() + ' times per second');
    if (printDebug) {
        setTimeout(printAverageResponseTime, 1000);
    }
};

async.series(createTaskArray(), function (err) {
    console.log('error ' + err);
    printDebug = false;
});



printAverageResponseTime();