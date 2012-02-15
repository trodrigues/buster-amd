var buster = require("buster");
var amd = require("../lib/buster-amd");
var c = require("../../buster-configuration");

function withGroup(body, tests) {
    var group, rs, err, data, loadedTests;
    var instance = tests(
	function() { return group; },
	function() { return rs; },
	function() { return err; },
	function() { return data; },
	function() { return loadedTests; }
    );

    instance.setUp = function (done) {
        body.extensions = [amd];
	group = c.create().addGroup("test", body, __dirname + "/fixtures");

        group.bundleFramework().resolve().then(function (resourceSet) {
	    rs = resourceSet;
            var paths = resourceSet.loadPath.paths();
	    loadedTests = paths.filter(function (p) { return p.indexOf("/buster") !== 0; });
            rs.get("/buster/load-all.js").content().then(done(function (content) {
                data = content;
            }));
	});
    };

    return instance;
};

buster.testCase("AMD extension", {
    "configuration": {
	"empty group" : withGroup({}, function(group, rs, err, content) {
	    return {
		"disables autoRun": function() {
		    assert(group().options.autoRun === false);
		},

		"adds loader module": function() {
		    refute.defined(err());		    
		},

		"loader module starts test-run":  function() {
		    assert.match(content(), "buster.run();");
		},

		"loader module requires dependenceis": function() {
		    assert.match(content(), /^require\(\[\]/);
		},

		"loader module is appended to load": function (done) {
		    rs().serialize().then(done(function (res) {
			assert.match(res.loadPath, function (act) {
			    return act.indexOf("/buster/load-all.js") >= 0;
			});
		    }));
		}
	    };
	}),

	"group with tests": withGroup({
	    tests: ["foo-test.js", "bar-test.js"],
	    rootPath: "."
	}, function(group, rs, err, content, tests) {
	    return {
		"removes tests from group" : function() {
		     assert.equals(tests(), []);
		},

		"depends on tests from loader module" : function() {
		    assert.match(content(), "'foo-test', 'bar-test'");
		},

		"dependencies are declares as function parameters" : function() {
		    assert.match(content(), /function\(.+, .+\)/);
		},

		"declares tests as resources": function () {
                    var resourceSet = rs();
                    assert.defined(resourceSet.get("/foo-test.js"));
		    assert.defined(resourceSet.get("/bar-test.js"));
		}
	    };
	}),

	"group with decorated dependencies": withGroup({
	    tests: ["foo-test.js", "bar-test.js"],
	    "buster-amd": {
                pathMapper: function (path) {
                    return "plugin!" + path.replace(/^\//, "").replace(/\.js$/, "");
                }
            }
	}, function(group, rs, err, content, tests) {
	    return {
		"depends on tests from loader module" : function() {
		    assert.match(content(), /'plugin!foo-test', 'plugin!bar-test'/);
		}
	    };
	})
    }
});
