var fs = require('fs')
    , _ = require("lodash")
    , Q = require("q")
    , bowman = require('bowman')
    , util = bowman.util

var PLUGIN_NAME = 'BOWMAN-ANGULAR';
var FIELD_NAME = 'bowman-angular';

/**
 * TRANSFORM
 */

module.exports = transform;

function transform(bow){
    //TODO cleanup
    var root = bow.root;
    var util = bow.util;

    var config = bow.config[FIELD_NAME] || {};

    return angularize(root)
        .then(_.partial(addDependency, root))
        .then(bow.assign.bind(bow,'angular'))
}

function angularize(root){
    var scripts = util.fullPaths(root, null, 'scripts')
        , extract = _.map(scripts, extractFromFiles)
        , remap = _.partial(_.object, _.keys(scripts))
    return Q.all(extract).then(remap);
}

// ensure angular is a dependency if component contains angular.module
function addDependency(root, mods){
    _.each(mods, function(modules, pkgName){
        if(pkgName === 'angular') return;
        var pkg = root.packages[pkgName];
        if(_.size(modules) && !_.has(pkg.dependencies, 'angular')){
            pkg.dependencies = pkg.dependencies || {};
            pkg.dependencies['angular'] = "*";
            //console.log(PLUGIN_NAME, pkg.name, '- added angular as a dependency');
        }
    });
    return mods;
}

/**
 * API
 */

exports.getIndex = getIndex;
function getIndex(){
    return bowman().then(indexModules);
}

/*
 pass bower component names and angular module names
 returns all components required (including dependencies)
 */
//getComponents(['ui.router'],['angular-bootstrap']).then(console.log);
exports.getComponents = getComponents;
function getComponents(modules, include){
    modules = asArray(modules);
    include = asArray(include);

    return bowman()
        .then(function(root){
            var index = indexModules(root);
            include = _.union(include, findComponents(index, modules));
            return bowman.getDependencies(root, include);
        });
}

function indexModules(root){
    var index = {};
    _.each(root.packages, function(pkg, pkgName){
        _.each(pkg.angular || [], function(deps, moduleName){
            if(_.has(index, moduleName)){
                console.error(PLUGIN_NAME, 'duplicate module in', index[moduleName].name, 'and', pkgName);
            }
            index[moduleName] = {name: pkgName, dependencies: deps};
        })
    });
    return index;
}

function findComponents(index, mods){
    var modules = getModuleDependencies(index, mods);

    //check for missing modules
    var missing = _.difference(modules, _.keys(index), ['ng']);
    if(missing.length){
        console.error(PLUGIN_NAME, 'failed to locate required modules', missing);
    }

    modules = _.pick(index, modules);
    return _.uniq(_.pluck(modules, 'name'));
}

function getModuleDependencies(index, mods){
    var modules = [];
    while(mods.length){
        modules = _.union(modules, mods);
        var deps = _.pick(index, mods);
        mods = _.flatten(deps, 'dependencies')
        mods = _.difference(mods, modules); //Remove circular references
    }
    return modules;
}

/**
 * API
 */

exports.extractFromFiles = extractFromFiles;
function extractFromFiles(scripts, name){
    scripts = _.map(scripts, extractFromFile);
    return Q.all(scripts)
        .then(flattenObjects)
        .then(function(modules){
            var missing = validateDependencies(modules);
            if(missing){
                console.error(PLUGIN_NAME, name, "missing required modules", missing.join(", "));
            }
            return modules;
        })
}

exports.extractFromFile = extractFromFile;
function extractFromFile(script){
    return Q.nfcall(fs.readFile, script)
        .then(function(buf){
            return extractDeclaration(buf.toString());
        })
        .fail(function(err){
            err = (err.code == 'ENOENT') ? ('file not found: ' + err.path) : err;
            console.error(PLUGIN_NAME, err);
            return {};
        })

}

// RegEx from angular-ngcompile (MIT)
var REG_STRIP_COMMENTS = /((^\\\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
var REG_MODULES = /\.module\(\s*('[^']*'|"[^"]*")\s*,(?:\s*\[([^\]]+)\])?/g;
var REG_MODULE_DEPS = /\s*,\s*/;

exports.extract = extractDeclaration;
function extractDeclaration(contents, verbose){
    var match = null;

    var modules = {};

    contents = contents.replace(REG_STRIP_COMMENTS, "");
    while(match = REG_MODULES.exec(contents)){
        var modName = match[1].slice(1, -1);
        var deps = match[2];

        modules[modName] = [];

        if(deps && (deps = deps.trim())){
            deps = deps.split(REG_MODULE_DEPS);
            modules[modName] = _.map(deps, function(dep){
                return dep.slice(1, -1); // remove the quotes
            });
        }
    }
    return modules;
}

// returns missing
exports.validate = validateDependencies;
function validateDependencies(modules){
    var moduleNames = _.keys(modules)
    moduleNames.push('ng');

    var missing = [];

    _.each(modules, function(module){
        _.each(module, function(dep){
            if(!_.contains(moduleNames, dep)) missing.push(dep);
        });
    });

    if(missing.length){
        missing.sort();
        missing = _.uniq(missing, true);
        return missing;
    }
}

/**
 * Helpers
 */

// [o1,o2,o3...] -> o
function flattenObjects(arr){
    arr = asArray(arr);
    arr.unshift({});
    return _.merge.apply(_, arr);
}

function asArray(x){
    return _.isString(x) ? [x] : _.toArray(x);
}

function normalize(src){
    return src.replace(/\\/g, '/');
}
