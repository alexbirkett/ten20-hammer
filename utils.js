

module.exports.doWhilstParallel = function(fn, test, callback) {
    var callCount = 0;
    var functionCallback = function(err) {
        callCount--;
        if (callCount === 0) {
            callback(err);
        }
    };
    do {
        callCount++;
        fn(functionCallback);
    } while (test());
};