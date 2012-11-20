/**
 * SMC - Compiler
 * Copyright(c) 2010 ~ 2012 Alibaba.com, Inc.
 * MIT Licensed
 */

var Loader = require('./loader'),
	Parser = require('./parser'),
	util = require('./util'),
	versionMgr = require('./versionManager');

var	PATTERN_ASYNC = /([^\.](?:seajs\.use|require\.async)\s*\(\s*\[?)(.*?)(\]?\s*\))/g,

	PATTERN_DEFINE = /^\s*define\s*\((.*?)function/m,

	PATTERN_DEFINE_FULL = /(^\s*define\s*\(\s*['"].*?['"]\s*,\s*\[)(.*?)(\]\s*,\s*function)/m,

	PATTERN_EXTNAME = /\.\w+$/,

	PATTERN_ID = /(['"])(.*?)(['"])/g,

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
	 * Detect and skip file that is compiled or is not a module.
	 * @param file {Object}
	 * @return {boolean}
	 */
	skip = function (file) {
		var re = file.data.match(PATTERN_DEFINE);

		return re === null || re[1].trim() !== '';
	},

	// Compiler constructor.
	Compiler = util.inherit(Object, {
		/**
		 * Initializer.
		 * @param config {Object}
		 */
		_initialize: function (config) {
			this._config = config;
			this._loader = new Loader(config);
			this._parser = new Parser(config);

			this._appendStamp = this._appendStamp.bind(this);
		},

		/**
		 * Time stamp replacer.
		 * @param all {string}
		 * @param lStatement {string}
		 * @param id {string}
		 * @param rStatement {string}
		 * @return {string}
		 */
		_appendStamp: function (all, lStatement, id, rStatement) {
			var parser = this._parser;

			id = id.replace(PATTERN_ID, function (all, lquote, id, rquote) {
				if (id !== '$') {
					id += '?t=#stamp(\'' + parser.id2Pathname(id) + '\')';
				}

				return lquote + id + rquote;
			});

			return lStatement + id + rStatement;
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
						file.flat = util.unique(flat);
						callback(null, file);
					}
				}(0));
			}
		},

		/**
		 * Generate unicorn comments.
		 * @param pathnames {Array}
		 * @return {string}
		 */
		_generateComments: function (pathnames) {
			return pathnames
				.filter(function (pathname) {
					return pathname !== '$';
				})
				.map(function (pathname) {
					return '#optional(\''
						+ pathname.replace(PATTERN_RANGED_VERSION, '$1')
						+'\')';
				})
				.join('\r\n');
		},

		/**
		 * Generate seajs module flatten dependency ids.
		 * @param pathnames {Array}
		 * @return {string}
		 */
		_generateDeps: function (pathnames) {
			return pathnames.map(function (pathname) {
				return '"' + this._generateId(pathname) + '"';
			}, this).join(', ');
		},

		/**
		 * Generate seajs module id.
		 * @param pathname {string}
		 * @return {string}
		 */
		_generateId: function (pathname) {
			var config = this._config;

			return pathname === '$' ?
				'$' : '#' + pathname
					.replace(config.base, '')
					.replace(PATTERN_EXTNAME, '');
		},

		/**
		 * Load file.
		 * @param pathname {string}
		 * @param callback {Function}
		 * @param trace {Array}
		 */
		_load: function (pathname, callback, trace) {
			var loader = this._loader;

			try {
				pathname = pathname === '$' ?
					null : versionMgr.parse(pathname, trace);
				if (!pathname) {
					callback(null, null);
				} else {
					loader.load(pathname, callback);
				}
			} catch (err) {
				callback(err);
			}
		},

		/**
		 * Convert alias to id.
		 * @param file {Object}
		 */
		_parseAlias: function (file) {
			var parser = this._parser;

			parser.alias2Id(file);
		},

		/**
		 * Resolve full dependencies.
		 * @param file {Object}
		 */
		_resolveDependencies: function (file, callback, _trace) {
			var parser = this._parser;

			parser.parseDependencies(file);

			this._flatten(file, function (err, file) {
				if (err) {
					callback(err);
				} else {
					callback(null, file);
				}
			}, _trace);
		},

		/**
		 * Rewrite seajs header.
		 * @param file {Object}
		 */
		_rewriteHead: function (file) {
			var data = file.data,
				head = 'define("%s", [ %s ], function',
				self = this;

			// Generate seajs header.
			data = data.replace(PATTERN_DEFINE, function () {
				var id = self._generateId(file.pathname),
					deps = self._generateDeps(file.flat);

				return util.format(head, id, deps);
			});

			// Add unicorn dependencies comments.
			data = this._generateComments(file.deps)
				+ '\r\n\r\n'
				+ data;

			file.data = data;
		},

		/**
		 * Append time stamp.
		 * @param file {Object}
		 */
		_stamp: function (file) {
			var config = this.config,
				replacer = this._appendStamp;

			file.data = file.data
				.replace(PATTERN_DEFINE_FULL, replacer)
				.replace(PATTERN_ASYNC, replacer);
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

			self._load(pathname, function (err, file) {
				if (err) {
					callback(err);
				} else if (!file) {
					callback(null, { pathname: pathname });
				} else if (skip(file)) {
					callback(null, file);
				} else {
					self._parseAlias(file);
					self._resolveDependencies(file, function (err, file) {
						if (err) {
							callback(err);
						} else {
							if (_trace.length === 0) {
								self._rewriteHead(file);
								self._stamp(file);
							}
							callback(null, file);
						}
					}, _trace);
				}
			}, _trace);
		}
	});

module.exports = Compiler;
