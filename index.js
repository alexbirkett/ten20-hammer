var optimist = require('optimist');
var requestApi = require('request');
var request = requestApi.defaults({followRedirect: false, jar: requestApi.jar()});
var async = require('async');

var argv = optimist.usage('Usage: $0  --serial [string] --url [string] --frequency [num]').
    options('n', {
        alias: 'number',
        describe: 'number of trackers'
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
    default('o', 1000).
    default('f', 1).
    default('n', 1000).
    default('u', 'http://localhost:3001')
    .argv;

console.log(argv);

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

var doWhilstParallel = function(fn, test, callback) {
    var callCount = 0;
    var functionCallback = function(err) {
        callCount--;
        if (callCount === 0) {
          console.log('calling back');
          callback(err);
      }
    };
    do {
        callCount++;
        fn(functionCallback);
    } while (test());
};

var createUsers = function(number, callback) {
    console.log('creating ' + number + ' users');
    var i = 0;
    doWhilstParallel(function(callback) {
        var credential = getCredential(i);
        signup(requests[i], credential, callback);
    },function() {
        return (++i < number);
    }, callback);
};

var signInAllUsers = function(number, callback) {
    console.log('signing in ' + number + ' users');
    var i = 0;
    doWhilstParallel(function(callback) {
        var credential = getCredential(i);
        signin(requests[i], credential, callback);
    },function() {
        return (++i < number);
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

    return tasks;
};

createRequests(argv['number-of-users']);

async.series(createTaskArray(), function (err) {
    console.log('error ' + err);
});




