

module.exports.doWhilstParallel = function(fn, test, callback) {
    var callCount = 0;

    var calledBack = false;

    var functionCallback = function(err) {
        callCount--;
        if (err || (callCount === 0 && !calledBack)) {
            callback(err);
            calledBack = true;
        }
    };
    do {
        callCount++;
        fn(functionCallback);
    } while (test());
};