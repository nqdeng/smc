/**
 * SMC - AliasManager
 * Copyright(c) 2010 ~ 2012 Alibaba.com, Inc.
 * MIT Licensed
 */

var url = require('url'),
	util = require('./util');

var PATTERN_ID = /(^|[^\.])(require)\s*\(\s*(['"])(.*?)(['"])\s*\)/g,

	PATTERN_VERSION = /^(.*?)\/(\d+\.\d+\.\d+[\+\-]?)\//,

	// AliasManager constructor.
	AliasManager = util.inherit(Object, {
		/**
		 * Initializer.
		 * @param config {Object}
		 */
		_initialize: function (config) {
			this._config = config;
			this._cache = {};
		},

		/**
		 * Draw version data from alias.
		 * @param alias {Object}
		 * @return {Object}
		 */
		_drawVersion: function (alias) {
			var config = this._config,
				versions = {};

			util.each(alias, function (value) {
				var re = value.match(PATTERN_VERSION);

				if (re) {
					versions[config.base + re[1]] = re[2];
				}
			});

			return versions;
		},

		/**
		 * Load package file.
		 * @param startDir {string}
		 * @param callback {Function}
		 */
		_loadPackage: function (startDir, callback) {
			var config = this._config,
				cache = this._cache,
				self =  this;

			if (startDir in cache) {
				callback(null, cache[startDir]);
			} else {
				(function next(dirname) {
					var pathname = decodeURI(url.resolve(dirname, 'package.json'));

					config.fileLoader.load(pathname, function (err, file) {
						var pkg;

						if (err) {
							if (dirname !== '/') {
								next(decodeURI(url.resolve(dirname, '../')));
							} else {
								cache[startDir] = {
									alias: {},
									versions: {}
								};
								callback(null, cache[startDir]);
							}
						} else {
							try {
								pkg = JSON.parse(file.data);
							} catch (err) {
								callback(err);
							}
							pkg.alias = pkg.alias || {};
							pkg.versions = self._drawVersion(pkg.alias);
							cache[startDir] = pkg;
							callback(null, pkg);
						}
					});
				}(startDir));
			}
		},

		/**
		 * Resolve alias.
		 * @param file {Object}
		 * @param callback {Function}
		 */
		resolve: function (file, callback) {
			var config = this._config,
				dirname = decodeURI(url.resolve(file.pathname, './'));

			this._loadPackage(dirname, function (err, pkg) {
				if (err) {
					callback(err);
				} else {
					file.versions = pkg.versions;
					file.data = file.data.replace(PATTERN_ID, function ($0, $1, $2, $3, $4, $5) {
						var parts, first, pathname,
							id = $4;

						if (id.charAt(0) !== '#') {
							parts = id.split('/');
							first = parts[0];

							if (pkg.alias.hasOwnProperty(first)) {
								parts[0] = pkg.alias[first];
								id = parts.join('/');
							}

							if (id.charAt(0) === '.') { // Resolve related pathname.
								pathname = decodeURI(url.resolve(file.pathname, id));
								id = pathname.replace(config.base, '');
							} else {
								pathname = config.base + id;
							}

							// Resolved id should start with #.
							return $1 + $2 + '(' + $3 + '#' + id + $5 + ')';
						} else {
							return $0;
						}
					});

					callback(null, file);
				}
			});
		}
	});

module.exports = AliasManager;
