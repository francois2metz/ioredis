import * as sinon from "sinon";
import Redis from "../../lib/redis";

afterEach(function (done) {
  sinon.restore();
  new Redis(`redis://redis:6379/`)
    .pipeline()
    .flushall()
    .script("flush")
    .client("kill", "normal")
    .exec(done);
});

console.error = function () {};
