import Redis from "../../lib/redis";
import MockServer from "../helpers/mock_server";

describe("sentinel_nat", function () {
  it("connects to server as expected", function (done) {
    const sentinel = new MockServer(27379, function (argv) {
      if (argv[0] === "sentinel" && argv[1] === "get-master-addr-by-name") {
        return ["127.0.0.1", "17380"];
      }
    });

    const redis = new Redis({
      sentinels: [{ host: "127.0.0.1", port: 27379 }],
      natMap: {
        "127.0.0.1:17380": {
          host: "redis",
          port: 6379,
        },
      },
      name: "master",
      lazyConnect: true,
    });

    redis.connect(function (err) {
      if (err) {
        sentinel.disconnect(function () {});
        return done(err);
      }
      sentinel.disconnect(done);
    });
  });

  it("rejects connection if host is not defined in map", function (done) {
    const sentinel = new MockServer(27379, function (argv) {
      if (argv[0] === "sentinel" && argv[1] === "get-master-addr-by-name") {
        return ["127.0.0.1", "17380"];
      }

      if (
        argv[0] === "sentinel" &&
        argv[1] === "sentinels" &&
        argv[2] === "master"
      ) {
        return ["127.0.0.1", "27379"];
      }
    });

    const redis = new Redis({
      sentinels: [{ host: "127.0.0.1", port: 27379 }],
      natMap: {
        "127.0.0.1:17381": {
          host: "localhost",
          port: 6379,
        },
      },
      maxRetriesPerRequest: 1,
      name: "master",
      lazyConnect: true,
    });

    redis
      .connect()
      .then(function () {
        throw new Error("Should not call");
      })
      .catch(function (err) {
        if (err.message === "Connection is closed.") {
          return done(null);
        }
        sentinel.disconnect(done);
      });
  });
});
