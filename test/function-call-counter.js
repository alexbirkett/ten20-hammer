
var FunctionCallCounter = require('../function-call-counter');
var assert = require('assert');

describe('test function call counter', function () {


    it('should return 3 when called 3 times within a second', function (done) {

        var functionCallCounter = new FunctionCallCounter();
        functionCallCounter.called();
        functionCallCounter.called();
        functionCallCounter.called();
        assert.equal(functionCallCounter.count(), 3);
        done();
    });

    it('should return 0 when called 3 times more than 1 second ago', function (done) {

        var functionCallCounter = new FunctionCallCounter();
        functionCallCounter.called();
        functionCallCounter.called();
        functionCallCounter.called();

        setTimeout(function()  {
            assert.equal(functionCallCounter.count(), 0);
            done();
        }, 1100);

    });


});
