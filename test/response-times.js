
var ResponseTimes = require('../response-times');
var assert = require('assert');

describe('test response times', function () {


    it('should calculate average', function (done) {

        var responseTimes = new ResponseTimes(100);
        responseTimes.addTime(10);
        responseTimes.addTime(20);
        assert.equal(responseTimes.calculateAverage(), 15);
        done();
    });

    it('should only include last 100 requests in average', function (done) {

        var responseTimes = new ResponseTimes(100);
        for (var i = 0; i < 100; i++) {
            responseTimes.addTime(10);
        }

        for (var i = 0; i < 100; i++) {
            responseTimes.addTime(20);
        }

        assert.equal(responseTimes.calculateAverage(), 20);
        done();
    });


});
