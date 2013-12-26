


var times = [];

var MAX_SIZE = 100;

module.exports.addTime = function(time) {
    times.push(time);
    if (times.length > MAX_SIZE) {
        times.shift();
    }
};

module.exports.calculateAverage = function() {

  var sum = 0;
  times.forEach(function(time) {
      sum += time;
  });
  return sum / times.length;
};