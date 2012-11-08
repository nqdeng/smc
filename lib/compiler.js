/**
 * SMC - Compiler
 * Copyright(c) 2010 ~ 2012 Alibaba.com, Inc.
 * MIT Licensed
 */

var AliasManager = require('./aliasManager'),
	depsParser = require('./dependenciesParser'),
	util = require('./util'),
	verParser = require('./versionParser');

var	PATTERN_DEFINE = /(^|[^\.])define\s*\(.*?function/,

	PATTERN_EXTNAME = /\.\w+$/,

	PATTERN_RANGED_VERSION = /(\d+\.\d+\.\d+)[\+\-]/,

	/**
	 * Handle circular dependencies error.
	 * @param file {Object}
	 * @param trace {Array}
	 * @param callback {Function}
	 */
	circle = function (file, trace, callback) {
		var orbit = trace.concat(file).map(function (value) {
				return value.name;
			}).join(' -> '),
			message = 'Circular dependencies found: ' + orbit;

		callback(new Error(message));
	},

	/**
	 * Convert ranged version to fixed version in pathname.
	 * @param pathname {string}
	 * @return {string}
	 */
	fix = function (pathname) {
		return pathname.replace(PATTERN_RANGED_VERSION, '$1');
	},

	// Compiler constructor.
	Compiler = util.inherit(Object, {
		/**
		 * Initializer.
		 * @param config {Object}
		 */
		_initialize: function (config) {
			this._config = config;
			this._cache = {};
			this._aliasMgr = new AliasManager(config);
		},

		/**
		 * Flatten dependencies.
		 * @param file {Object}
		 * @param callback {Function}
		 * @param [_trace] {Array}
		 */
		_flatten: function (file, callback, _trace) {
			var deps = file.deps,
				flat = [],
				self = this;

			if (_trace.indexOf(file) !== -1) {
				circle(file, _trace, callback);
			} else {
				_trace.push(file);
				(function next(i) {
					if (i < deps.length) {
						self.compile(deps[i], function (err, file) {
							if (err) {
								callback(err);
							} else {
								flat = flat.concat(file.flat || []).concat(file.pathname);
								next(i + 1);
							}
						}, _trace);
					} else {
						_trace.pop();
						callback(null, util.unique(flat));
					}
				}(0));
			}
		},

		/**
		 * Generate seajs module flatten dependency ids.
		 * @param pathnames {Array}
		 * @return {string}
		 */
		_generateDeps: function (pathnames) {
			return pathnames.map(function (pathname) {
				return '"'
					+ this._generateId(pathname)
					+ '?t=#ts("' + fix(pathname) + '")'
					+ '"';
			}, this).join(', ');
		},

		/**
		 * Generate seajs module id.
		 * @param pathname {string}
		 * @return {string}
		 */
		_generateId: function (pathname) {
			var config = this._config;

			return '#'
				+ pathname
					.replace(config.base, '')
					.replace(PATTERN_EXTNAME, '');
		},

		/**
		 * Generate unicorn relationship comments.
		 * @param pathnames {Array}
		 * @return {string}
		 */
		_generateRelations: function (pathnames) {
			return pathnames.map(function (pathname) {
				return '// #optional <' + fix(pathname) +'>';
			}).join('\r\n');
		},

		/**
		 * Load a file.
		 * @param pathname {Array}
		 * @param callback {Function}
		 * @param trace {Array}
		 */
		_load: function (pathname, trace, callback) {
			var config = this._config,
				cache = this._cache,
				aliasMgr = this._aliasMgr;

			try {
				pathname = verParser.parse(pathname, trace);

				if (!pathname) {
					callback(null, null);
				} else if (cache[pathname]) {
					callback(null, cache[pathname]);
				} else {
					config.fileLoader.load(pathname, function (err, file) {
						if (err) {
							callback(err);
						} else {
							aliasMgr.resolve(file, function (err, file) {
								if (err) {
									callback(err);
								} else {
									depsParser.parse(file, config.base);
									cache[pathname] = file;
									callback(null, file);
								}
							});
						}
					});
				}
			} catch (err) {
				callback(err);
			}
		},

		/**
		 * Update seajs module.
		 * @param file {Object}
		 */
		_refine: function (file) {
			var config = this._config,
				data = file.data,
				head = '%sdefine("%s", [ %s ], function',
				self = this;

			// Generate seajs header.
			data = data.replace(PATTERN_DEFINE, function ($0, $1) {
				var id = self._generateId(file.pathname),
					deps = self._generateDeps(file.flat);

				return util.format(head, $1, id, deps);
			});

			// Add unicorn dependencies comments.
			data = this._generateRelations(file.deps)
				+ '\r\n\r\n'
				+ data;

			file.data = data;
		},

		/**
		 * Compile a file.
		 * @param pathname {Array}
		 * @param callback {Function}
		 * @param [_trace] {Array}
		 */
		compile: function (pathname, callback, _trace) {
			var self = this;

			_trace = _trace || [];

			this._load(pathname, _trace, function (err, file) {
				if (err) {
					callback(err);
				} else if (file) {
					self._flatten(file, function (err, flat) {
						if (err) {
							callback(err);
						} else {
							file.flat = flat;
							if (_trace.length === 0) {
								self._refine(file);
							}
							callback(null, file);
						}
					}, _trace);
				} else {
					callback(null, { pathname: pathname });
				}
			});
		}
	});

module.exports = Compiler;
