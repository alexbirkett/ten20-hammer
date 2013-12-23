
var utils = require('../utils');
var assert = require('assert');
describe('test utils', function () {


    it('functions should be called in parallel', function (done) {

        var i = 0;
        var callbackCount = 0;
        var fn = function(callback) {
            i++;
            assert.equal(callbackCount, 0);
            setTimeout(function() {
                callbackCount++;
                callback();
            }, 100);
        };

        var test = function() {
            return i < 10;
        };


        utils.doWhilstParallel(fn, test, function(err) {
            assert.equal(i, 10);
            assert.equal(callbackCount, 10);
            done();

        });


    });


});
