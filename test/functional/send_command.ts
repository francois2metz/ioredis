import Redis from "../../lib/redis";
import { expect } from "chai";

describe("send command", function () {
  it("should support callback", function (done) {
    const redis = new Redis({ host: 'redis' });
    redis.set("foo", "bar");
    redis.get("foo", function (err, result) {
      expect(result).to.eql("bar");
      done();
    });
  });

  it("should support promise", function () {
    const redis = new Redis({ host: 'redis' });
    redis.set("foo", "bar");
    return redis.get("foo").then(function (result) {
      expect(result).to.eql("bar");
    });
  });

  it("should keep the response order when mix using callback & promise", function (done) {
    const redis = new Redis({ host: 'redis' });
    let order = 0;
    redis.get("foo").then(function () {
      expect(++order).to.eql(1);
    });
    redis.get("foo", function () {
      expect(++order).to.eql(2);
    });
    redis.get("foo").then(function () {
      expect(++order).to.eql(3);
    });
    redis.get("foo", function () {
      expect(++order).to.eql(4);
      done();
    });
  });

  it("should support get & set buffer", function (done) {
    const redis = new Redis({ host: 'redis' });
    redis.set(Buffer.from("foo"), Buffer.from("bar"), function (err, res) {
      expect(res).to.eql("OK");
    });
    redis.getBuffer(Buffer.from("foo"), function (err, result) {
      expect(result).to.be.instanceof(Buffer);
      expect(result.toString()).to.eql("bar");
      done();
    });
  });

  it("should support get & set buffer via `call`", function (done) {
    const redis = new Redis({ host: 'redis' });
    redis.call("set", Buffer.from("foo"), Buffer.from("bar"), function (
      err,
      res
    ) {
      expect(res).to.eql("OK");
    });
    redis.callBuffer("get", Buffer.from("foo"), function (err, result) {
      expect(result).to.be.instanceof(Buffer);
      expect(result.toString()).to.eql("bar");
      done();
    });
  });

  it("should handle empty buffer", function (done) {
    const redis = new Redis({ host: 'redis' });
    redis.set(Buffer.from("foo"), Buffer.from(""));
    redis.getBuffer(Buffer.from("foo"), function (err, result) {
      expect(result).to.be.instanceof(Buffer);
      expect(result.toString()).to.eql("");
      done();
    });
  });

  it("should support utf8", function (done) {
    const redis = new Redis({ host: 'redis' });
    redis.set(Buffer.from("你好"), String("你好"));
    redis.getBuffer("你好", function (err, result) {
      expect(result.toString()).to.eql("你好");
      redis.get("你好", function (err, result) {
        expect(result).to.eql("你好");
        done();
      });
    });
  });

  it("should consider null as empty str", function (done) {
    const redis = new Redis({ host: 'redis' });
    redis.set("foo", null, function () {
      redis.get("foo", function (err, res) {
        expect(res).to.eql("");
        done();
      });
    });
  });

  it("should support return int value", function (done) {
    const redis = new Redis({ host: 'redis' });
    redis.exists("foo", function (err, exists) {
      expect(typeof exists).to.eql("number");
      done();
    });
  });

  it("should reject when disconnected", function (done) {
    const redis = new Redis({ host: 'redis' });
    redis.disconnect();
    redis.get("foo", function (err) {
      expect(err.message).to.match(/Connection is closed./);
      done();
    });
  });

  it("should reject when enableOfflineQueue is disabled", function (done) {
    const redis = new Redis({ host: 'redis', enableOfflineQueue: false });
    redis.get("foo", function (err) {
      expect(err.message).to.match(/enableOfflineQueue options is false/);
      done();
    });
  });

  it("should support key prefixing", function (done) {
    const redis = new Redis({ host: 'redis', keyPrefix: "foo:" });
    redis.set("bar", "baz");
    redis.get("bar", function (err, result) {
      expect(result).to.eql("baz");
      redis.keys("*", function (err, result) {
        expect(result).to.eql(["foo:bar"]);
        done();
      });
    });
  });

  it("should support key prefixing with multiple keys", function (done) {
    const redis = new Redis({ host: 'redis', keyPrefix: "foo:" });
    redis.lpush("app1", "test1");
    redis.lpush("app2", "test2");
    redis.lpush("app3", "test3");
    redis.blpop("app1", "app2", "app3", 0, function (err, result) {
      expect(result).to.eql(["foo:app1", "test1"]);
      redis.keys("*", function (err, result) {
        expect(result).to.have.members(["foo:app2", "foo:app3"]);
        done();
      });
    });
  });

  it("should support key prefixing for zunionstore", function (done) {
    const redis = new Redis({ host: 'redis', keyPrefix: "foo:" });
    redis.zadd("zset1", 1, "one");
    redis.zadd("zset1", 2, "two");
    redis.zadd("zset2", 1, "one");
    redis.zadd("zset2", 2, "two");
    redis.zadd("zset2", 3, "three");
    redis.zunionstore("out", 2, "zset1", "zset2", "WEIGHTS", 2, 3, function (
      err,
      result
    ) {
      expect(result).to.eql(3);
      redis.keys("*", function (err, result) {
        expect(result).to.have.members(["foo:zset1", "foo:zset2", "foo:out"]);
        done();
      });
    });
  });

  it("should support key prefixing for sort", function (done) {
    const redis = new Redis({ host: 'redis', keyPrefix: "foo:" });
    redis.hset("object_1", "name", "better");
    redis.hset("weight_1", "value", "20");
    redis.hset("object_2", "name", "best");
    redis.hset("weight_2", "value", "30");
    redis.hset("object_3", "name", "good");
    redis.hset("weight_3", "value", "10");
    redis.lpush("src", "1", "2", "3");
    redis.sort(
      "src",
      "BY",
      "weight_*->value",
      "GET",
      "object_*->name",
      "STORE",
      "dest",
      function (err, result) {
        redis.lrange("dest", 0, -1, function (err, result) {
          expect(result).to.eql(["good", "better", "best"]);
          redis.keys("*", function (err, result) {
            expect(result).to.have.members([
              "foo:object_1",
              "foo:weight_1",
              "foo:object_2",
              "foo:weight_2",
              "foo:object_3",
              "foo:weight_3",
              "foo:src",
              "foo:dest",
            ]);
            done();
          });
        });
      }
    );
  });

  it("should allow sending the loading valid commands in connect event", function (done) {
    const redis = new Redis({ host: 'redis', enableOfflineQueue: false });
    redis.on("connect", function () {
      redis.select(2, function (err, res) {
        expect(res).to.eql("OK");
        done();
      });
    });
  });

  it("should reject loading invalid commands in connect event", function (done) {
    const redis = new Redis({ host: 'redis', enableOfflineQueue: false });
    redis.on("connect", function () {
      redis.get("foo", function (err) {
        expect(err.message).to.eql(
          "Stream isn't writeable and enableOfflineQueue options is false"
        );
        done();
      });
    });
  });

  it("throws for invalid command", async () => {
    const redis = new Redis({ host: 'redis' });
    const invalidCommand = "áéűáű";
    let err;
    try {
      await redis.call(invalidCommand, []);
    } catch (e) {
      err = e.message;
    }
    expect(err).to.contain("unknown command");
    expect(err).to.contain(invalidCommand);
  });
});
